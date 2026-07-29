import { verifyAdmin } from '@/lib/admin-auth'
import { buildMatchQuery, rankCandidates, scoreHistogram, CachedVideo } from '@/lib/video-matching'
import { classifyMovement } from '@/lib/movement-classification'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1: matching dry run. Zero YouTube quota, zero writes.
//
//  Two jobs:
//
//  1. SEGMENT the whole uncurated backlog into 'fitness' and 'trick' tracks.
//     Trick content (skate, BMX, scooter) has no clean demonstration on
//     YouTube, so it should never enter curation or spend fallback calls. This
//     reports COUNTS ONLY. Nothing is persisted until Will approves the split.
//
//  2. CALIBRATE the confidence threshold by matching a stratified sample of the
//     FITNESS track only. v1 sampled alphabetically and landed in a block of
//     numeric BMX trick names, which made local matching look far worse than it
//     is. Sampling now spreads evenly across the whole backlog.
// ─────────────────────────────────────────────────────────────────────────────

const TIME_BUDGET_MS = 40_000
const CONCURRENCY = 10
const CANDIDATES_PER_EXERCISE = 30
const PAGE = 1000

type ExRow = { id: string; name_display: string; source_program: string | null }

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const started = Date.now()
  const body = await req.json().catch(() => ({}))
  const sampleSize: number = Math.min(Math.max(Number(body.sampleSize ?? 250), 1), 1000)
  const supabase = auth.supabase

  // ── Pull the whole uncurated backlog (paginated past the 1,000 row cap) ────
  const all: ExRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('id, name_display, source_program')
      .is('video_url', null)
      .order('name_display')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const rows = (data ?? []) as ExRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  if (!all.length) return Response.json({ error: 'No uncurated exercises' }, { status: 400 })

  // ── Job 1: segment the backlog (counts only, nothing written) ─────────────
  const classified = all.map(ex => ({ ex, c: classifyMovement(ex.name_display, ex.source_program) }))
  const tricks  = classified.filter(r => r.c.track === 'trick')
  const fitness = classified.filter(r => r.c.track === 'fitness')

  // Group tricks by their sport tag so the split is reviewable.
  const trickBySource: Record<string, number> = {}
  for (const t of tricks) {
    const key = t.ex.source_program ?? '(no sport tag)'
    trickBySource[key] = (trickBySource[key] ?? 0) + 1
  }

  // ── Job 2: stratified sample of the FITNESS track only ────────────────────
  const step = Math.max(1, Math.floor(fitness.length / sampleSize))
  const sample: ExRow[] = []
  for (let i = 0; i < fitness.length && sample.length < sampleSize; i += step) {
    sample.push(fitness[i].ex)
  }

  type Result = { exercise: string; topScore: number; candidateCount: number; bestTitle: string | null; reasons: string[] }
  const results: Result[] = []
  let timedOut = false

  async function matchOne(ex: ExRow): Promise<Result> {
    const q = buildMatchQuery(ex.name_display)
    const { data, error } = await supabase.rpc('match_channel_videos', { q, match_limit: CANDIDATES_PER_EXERCISE })
    if (error) return { exercise: ex.name_display, topScore: 0, candidateCount: 0, bestTitle: null, reasons: [`rpc error: ${error.message}`] }
    const candidates = (data ?? []) as CachedVideo[]
    if (!candidates.length) return { exercise: ex.name_display, topScore: 0, candidateCount: 0, bestTitle: null, reasons: ['no trigram candidates'] }
    const best = rankCandidates(ex.name_display, candidates)[0]
    return { exercise: ex.name_display, topScore: best.score, candidateCount: candidates.length, bestTitle: best.video.title, reasons: best.reasons }
  }

  for (let i = 0; i < sample.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) { timedOut = true; break }
    results.push(...await Promise.all(sample.slice(i, i + CONCURRENCY).map(matchOne)))
  }

  const scores = results.map(r => r.topScore)
  const sorted = [...scores].sort((a, b) => a - b)
  const pct = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0

  const tradeoff = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(t => {
    const hits = results.filter(r => r.topScore >= t).length
    return {
      threshold: t,
      matched_locally: hits,
      needs_fallback: results.length - hits,
      local_rate_pct: Number(((hits / Math.max(1, results.length)) * 100).toFixed(1)),
      // Projected across the whole fitness backlog, which is the number that
      // decides whether a threshold is affordable at 20 fallback calls a day.
      projected_fallback_backlog: Math.round((1 - hits / Math.max(1, results.length)) * fitness.length),
    }
  })

  const band = (lo: number, hi: number) =>
    results.filter(r => r.topScore >= lo && r.topScore < hi)
      .sort((a, b) => b.topScore - a.topScore)
      .slice(0, 4)
      .map(r => ({ exercise: r.exercise, score: r.topScore, matched: r.bestTitle, why: r.reasons }))

  return Response.json({
    youtube_units_spent: 0,
    backlog: {
      total_uncurated: all.length,
      fitness: fitness.length,
      trick: tricks.length,
      trick_pct: Number(((tricks.length / all.length) * 100).toFixed(1)),
      trick_by_source: Object.entries(trickBySource).sort((a, b) => b[1] - a[1]).slice(0, 15),
      trick_examples: tricks.slice(0, 8).map(t => ({ name: t.ex.name_display, why: t.c.reasons, confidence: t.c.confidence })),
      fitness_examples: fitness.slice(0, 5).map(f => f.ex.name_display),
    },
    sampled: results.length,
    sample_requested: sample.length,
    timed_out: timedOut,
    zero_candidates: results.filter(r => r.candidateCount === 0).length,
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
