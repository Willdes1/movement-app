import { verifyAdmin } from '@/lib/admin-auth'
import { buildMatchQuery, rankCandidates, scoreHistogram, CachedVideo } from '@/lib/video-matching'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1: matching dry run.
//
//  Runs local matching across uncurated exercises, fires NO search.list
//  fallback, writes nothing, and spends ZERO YouTube quota. Its only job is to
//  produce the evidence needed to choose the confidence threshold:
//
//    - a histogram of top-match scores
//    - the trade-off table: at each candidate threshold, how many exercises
//      would be satisfied locally vs pushed to the capped paid fallback
//    - worked examples from each score band, with the scorer's own reasons,
//      so the numbers can be sanity-checked against actual video titles
//
//  Deliberately not choosing a threshold in code. That is Will's call, made
//  from this output.
// ─────────────────────────────────────────────────────────────────────────────

const TIME_BUDGET_MS = 45_000
const CONCURRENCY = 8
const CANDIDATES_PER_EXERCISE = 50

type ExRow = { id: string; name_display: string }
type Result = {
  exercise: string
  topScore: number
  candidateCount: number
  bestTitle: string | null
  reasons: string[]
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const started = Date.now()
  const body = await req.json().catch(() => ({}))
  const sampleSize: number = Math.min(Math.max(Number(body.sampleSize ?? 300), 1), 1000)
  const offset: number = Math.max(Number(body.offset ?? 0), 0)

  const supabase = auth.supabase

  // Deterministic slice of the uncurated backlog, so two runs are comparable.
  const { data: exercises, error: exErr } = await supabase
    .from('exercise_library')
    .select('id, name_display')
    .is('video_url', null)
    .order('name_display')
    .range(offset, offset + sampleSize - 1)

  if (exErr) return Response.json({ error: exErr.message }, { status: 500 })
  if (!exercises?.length) return Response.json({ error: 'No uncurated exercises in that range' }, { status: 400 })

  const rows = exercises as ExRow[]
  const results: Result[] = []
  let timedOut = false

  async function matchOne(ex: ExRow): Promise<Result> {
    const q = buildMatchQuery(ex.name_display)
    const { data, error } = await supabase.rpc('match_channel_videos', {
      q,
      match_limit: CANDIDATES_PER_EXERCISE,
    })
    if (error) {
      return { exercise: ex.name_display, topScore: 0, candidateCount: 0, bestTitle: null, reasons: [`rpc error: ${error.message}`] }
    }
    const candidates = (data ?? []) as CachedVideo[]
    if (!candidates.length) {
      return { exercise: ex.name_display, topScore: 0, candidateCount: 0, bestTitle: null, reasons: ['no trigram candidates'] }
    }
    const ranked = rankCandidates(ex.name_display, candidates)
    const best = ranked[0]
    return {
      exercise: ex.name_display,
      topScore: best.score,
      candidateCount: candidates.length,
      bestTitle: best.video.title,
      reasons: best.reasons,
    }
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) { timedOut = true; break }
    const chunk = rows.slice(i, i + CONCURRENCY)
    results.push(...await Promise.all(chunk.map(matchOne)))
  }

  const scores = results.map(r => r.topScore)
  const sorted = [...scores].sort((a, b) => a - b)
  const pct = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0

  // The actual decision aid: what each threshold would cost in fallback calls.
  // The fallback is capped (default 20 calls/day at 100 units each), so a
  // threshold that pushes more than the cap per run is not affordable.
  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
  const tradeoff = thresholds.map(t => {
    const localHits = results.filter(r => r.topScore >= t).length
    return {
      threshold: t,
      matched_locally: localHits,
      needs_fallback: results.length - localHits,
      local_rate_pct: Number(((localHits / results.length) * 100).toFixed(1)),
    }
  })

  // Worked examples from each band so the numbers can be checked against reality.
  const band = (lo: number, hi: number) =>
    results.filter(r => r.topScore >= lo && r.topScore < hi)
      .sort((a, b) => b.topScore - a.topScore)
      .slice(0, 4)
      .map(r => ({ exercise: r.exercise, score: r.topScore, matched: r.bestTitle, why: r.reasons }))

  return Response.json({
    sampled: results.length,
    requested: rows.length,
    timed_out: timedOut,
    zero_candidates: results.filter(r => r.candidateCount === 0).length,
    youtube_units_spent: 0,
    percentiles: { p10: pct(0.10), p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), p90: pct(0.90) },
    histogram: scoreHistogram(scores),
    tradeoff,
    examples: {
      strong:  band(0.70, 1.01),
      middle:  band(0.45, 0.70),
      weak:    band(0.20, 0.45),
      nothing: band(0, 0.20),
    },
    elapsed_ms: Date.now() - started,
  })
}
