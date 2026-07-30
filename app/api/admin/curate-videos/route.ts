import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { ytFetch, getVideosBatched, beginYtBatch } from '@/lib/youtube'
import { buildMatchQuery, rankCandidates, CachedVideo } from '@/lib/video-matching'

// Match confidence required before a cached video is proposed without paying
// for a search. Overridable per request from the curation tab.
const DEFAULT_MATCH_THRESHOLD = 0.70

// Daily ceiling on paid search.list fallbacks, at 100 units each. 80 calls is
// 8,000 units. Local matching now costs nothing, so almost the whole 10,000
// budget is available for the exercises the cache genuinely cannot serve.
const DEFAULT_FALLBACK_CAP = 80

export const runtime = 'nodejs'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── YouTube helpers (all calls routed through lib/youtube.ts for logging) ─────
async function searchGeneral(query: string, batchId: string, isFallback = false): Promise<{ ids: string[]; error?: string }> {
  const { data, error } = await ytFetch('search', { part: 'id', q: query + ' exercise tutorial', type: 'video', maxResults: 5 }, { batchId, isFallback })
  if (data?.error || error) {
    const reason = data?.error?.errors?.[0]?.reason ?? data?.error?.message ?? error ?? 'unknown'
    return { ids: [], error: `YT API error (${data?.error?.code ?? ''}): ${reason}` }
  }
  const ids = (data?.items ?? []).map((i: { id: { videoId: string } }) => i.id.videoId).filter(Boolean)
  return { ids }
}

async function getVideoDetails(videoIds: string[], batchId: string): Promise<VideoDetail[]> {
  if (videoIds.length === 0) return []
  const items = await getVideosBatched(videoIds, ['snippet', 'contentDetails', 'statistics', 'status'], { batchId })
  return items
    .filter((v: { status?: { embeddable?: boolean } }) => v.status?.embeddable)
    .map((v: YTVideo) => ({
      videoId: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.snippet?.title ?? '',
      channelId: v.snippet?.channelId ?? '',
      channelTitle: v.snippet?.channelTitle ?? '',
      thumbnail: v.snippet?.thumbnails?.medium?.url ?? '',
      duration: parseDuration(v.contentDetails?.duration ?? ''),
      viewCount: parseInt(v.statistics?.viewCount ?? '0', 10),
    }))
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0')
}

type VideoDetail = {
  videoId: string; url: string; title: string; channelId: string
  channelTitle: string; thumbnail: string; duration: number; viewCount: number
}

type YTVideo = {
  id: string
  snippet?: { title?: string; channelId?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } }
  contentDetails?: { duration?: string }
  statistics?: { viewCount?: string }
  status?: { embeddable?: boolean }
}

// ─── Claude scoring ───────────────────────────────────────────────────────────
async function scoreCandidates(exerciseName: string, exerciseHow: string, candidates: VideoDetail[], strict = false) {
  if (candidates.length === 0) return []

  const candidateList = candidates.map((c, i) =>
    `[${i}] "${c.title}" by ${c.channelTitle} (${Math.round(c.viewCount / 1000)}K views, ${Math.round(c.duration / 60)} min)`
  ).join('\n')

  const strictNote = strict
    ? `\nBe strict about technique specificity. If the exercise has a specific movement pattern (e.g., directional descriptors, specific technique names), only videos clearly demonstrating that exact technique should score above 0.7. Generic or close-but-not-exact exercises should score below 0.5. It is acceptable to return fewer than 3 results if the candidates are poor matches.`
    : ''

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are reviewing YouTube videos to find the best demonstration for a fitness exercise.

Exercise: "${exerciseName}"
How to perform it: "${exerciseHow ?? 'No description available'}"

Candidates:
${candidateList}

Pick the best 3. Always return exactly 3 (or all of them if fewer than 3 exist). Score each 0.0–1.0 and give one sentence of reasoning. Include lower-scoring options rather than returning fewer than 3.${strictNote}

Return ONLY valid JSON array, no markdown:
[{"index": 0, "score": 0.92, "reasoning": "..."}]`
    }]
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try {
    return JSON.parse(cleaned) as { index: number; score: number; reasoning: string }[]
  } catch {
    return []
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const {
      exerciseId, exerciseIds, batchSize = 10, regenerate = false, lane = 'all',
      matchThreshold, fallbackDailyCap,
    } = await request.json().catch(() => ({}))
    const threshold = Number.isFinite(Number(matchThreshold))
      ? Math.min(Math.max(Number(matchThreshold), 0), 1) : DEFAULT_MATCH_THRESHOLD
    const fallbackCap = Number.isFinite(Number(fallbackDailyCap))
      ? Math.min(Math.max(Number(fallbackDailyCap), 0), 95) : DEFAULT_FALLBACK_CAP
    const batchId = beginYtBatch()

    // Load approved channels
    const { data: channels } = await supabaseAdmin
      .from('approved_yt_channels')
      .select('channel_id, channel_name, audience_focus, priority')
      .eq('active', true)
      .order('priority')

    if (!channels?.length) return Response.json({ error: 'No approved channels configured' }, { status: 400 })

    // ── Single exercise (unchanged) ──────────────────────────────────────────
    if (exerciseId) {
      const { data: exercises } = await supabaseAdmin
        .from('exercise_library')
        .select('id, name_display, how, name_normalized')
        .eq('id', exerciseId)
      const results = await processExercises(exercises ?? [], channels, regenerate, batchId, threshold, fallbackCap)
      return Response.json({ processed: results.length, results })
    }

    // ── Targeted batch: specific exercise IDs (for program/plans lanes) ──────
    if (exerciseIds && Array.isArray(exerciseIds) && exerciseIds.length > 0) {
      const { data: existingCands } = await supabaseAdmin
        .from('exercise_video_candidates')
        .select('exercise_id')
        .in('exercise_id', exerciseIds)
        .eq('status', 'proposed')
      const alreadyProposed = new Set((existingCands ?? []).map((r: { exercise_id: string }) => r.exercise_id))

      const { data: targeted } = await supabaseAdmin
        .from('exercise_library')
        .select('id, name_display, how, name_normalized')
        .in('id', exerciseIds)
        .is('video_url', null)

      const filtered = (targeted ?? []).filter((e: Exercise) => !alreadyProposed.has(e.id)).slice(0, batchSize)
      const results = await processExercises(filtered, channels, regenerate, batchId, threshold, fallbackCap)
      return Response.json({ processed: results.length, results })
    }

    // ── Default batch with lane priority ────────────────────────────────────
    const { data: existingCands } = await supabaseAdmin
      .from('exercise_video_candidates')
      .select('exercise_id, status, source_label')
      .in('status', ['proposed', 'queued'])

    const skip    = new Set<string>()
    const queued  = new Set<string>()
    for (const r of (existingCands ?? []) as { exercise_id: string; status: string; source_label: string | null }[]) {
      if (r.status === 'proposed') skip.add(r.exercise_id)
      if (r.status === 'queued')   queued.add(r.exercise_id)
    }

    // Fetch all unprocessed exercises (no video, not already proposed)
    const { data: all } = await supabaseAdmin
      .from('exercise_library')
      .select('id, name_display, how, name_normalized, source_program')
      .is('video_url', null)
      .order('name_display')

    const available = (all ?? []).filter((e: Exercise) => !skip.has(e.id))

    // Lane 'plans': only plan-queued (null or 'plan' source_label)
    // Lane 'backlog': only non-queued
    // Lane 'all' (default): queued first, then alphabetical
    let sorted: typeof available
    if (lane === 'plans') {
      const planQueuedIds = new Set(
        ((existingCands ?? []) as { exercise_id: string; status: string; source_label: string | null }[])
          .filter(r => r.status === 'queued' && (!r.source_label || r.source_label === 'plan'))
          .map(r => r.exercise_id)
      )
      sorted = available.filter((e: Exercise) => planQueuedIds.has(e.id))
    } else if (lane === 'backlog') {
      // Partition: the backlog is everything NOT owned by a named lane. Program /
      // Library-Builder-seeded exercises (source_program set) have their own lanes,
      // so exclude them here to avoid double-curating the same exercise.
      sorted = available.filter((e: Exercise) => !queued.has(e.id) && !(e as { source_program?: string | null }).source_program)
    } else {
      sorted = [
        ...available.filter((e: Exercise) => queued.has(e.id)),
        ...available.filter((e: Exercise) => !queued.has(e.id)),
      ]
    }

    const batch = sorted.slice(0, batchSize)
    const results = await processExercises(batch, channels, regenerate, batchId, threshold, fallbackCap)
    return Response.json({ processed: results.length, results })

  } catch (err) {
    console.error('Curation error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Curation failed' }, { status: 500 })
  }
}

type Channel = { channel_id: string; channel_name: string; audience_focus: string; priority: number }
type Exercise = { id: string; name_display: string; how: string | null; name_normalized: string }

function buildSearchQuery(name: string): string {
  return name
    .replace(/\s*[—–]\s*.+$/, '')           // strip em/en-dash suffixes ONLY — NOT regular hyphens
    .replace(/\s*\([^)]*\)/g, '')            // strip "(Kneeling)", "(Partial Range)" etc
    .replace(/\s+x?\d+\s*(rounds?|cycles?|reps?|sets?)/gi, '') // strip "4 Rounds", "x5 Rounds"
    .replace(/[/\\]/g, ' ')                  // "90/90" → "90 90"
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Local matching (0 quota) ─────────────────────────────────────────────────
// Replaces search.list as the discovery step. Postgres narrows the cached
// uploads index by trigram, Node scores precisely, and only the survivors cost
// a videos.list call (1 unit per 50 ids).
async function localMatch(ex: Exercise, threshold: number, excludeIds: Set<string>) {
  const q = buildMatchQuery(ex.name_display)
  const { data, error } = await supabaseAdmin.rpc('match_channel_videos', { q, match_limit: 30 })
  if (error || !data?.length) return { ids: [] as string[], topScore: 0 }
  const ranked = rankCandidates(ex.name_display, (data ?? []) as CachedVideo[])
    .filter(r => !excludeIds.has(r.video.video_id))
  const passing = ranked.filter(r => r.score >= threshold).slice(0, 6)
  return { ids: passing.map(r => r.video.video_id), topScore: ranked[0]?.score ?? 0 }
}

type CurationCtx = {
  regenerate: boolean
  batchId: string
  threshold: number
  fallbackBudget: { remaining: number }
  channels: Channel[]
}

async function processOne(ex: Exercise, ctx: CurationCtx) {
  const { regenerate, batchId, threshold, fallbackBudget } = ctx
  try {
    const apiErrors: string[] = []
    let allVideoIds: string[] = []
    let usedFallback = false

    // Regenerate must never re-search. It re-ranks the cache and skips whatever
    // was already proposed, which is what takes it from ~1,500 units to zero.
    const excludeIds = new Set<string>()
    if (regenerate) {
      const { data: prior } = await supabaseAdmin
        .from('exercise_video_candidates')
        .select('youtube_video_id')
        .eq('exercise_id', ex.id)
      for (const p of (prior ?? []) as { youtube_video_id: string }[]) excludeIds.add(p.youtube_video_id)
    }

    const local = await localMatch(ex, threshold, excludeIds)
    allVideoIds = local.ids

    // Paid fallback: only when local matching found nothing above the bar, and
    // only while there is budget left. Visible in the result either way.
    if (allVideoIds.length === 0) {
      if (fallbackBudget.remaining <= 0) {
        return {
          exercise: ex.name_display, status: 'fallback_capped',
          topScore: local.topScore,
          error: `no local match (best ${local.topScore.toFixed(2)}) and the daily search fallback cap is spent`,
        }
      }
      fallbackBudget.remaining -= 1
      usedFallback = true
      const { ids, error } = await searchGeneral(buildSearchQuery(ex.name_display), batchId, true)
      if (error) apiErrors.push(error)
      allVideoIds = ids
    }

    const unique = [...new Set(allVideoIds)]
    const details = await getVideoDetails(unique.slice(0, 12), batchId)

    if (details.length === 0) {
      const errSuffix = apiErrors.length ? ` [${apiErrors[0]}]` : ''
      return { exercise: ex.name_display, status: 'no_results', usedFallback, error: errSuffix || undefined }
    }

    const scored = await scoreCandidates(ex.name_display, ex.how ?? '', details, regenerate)
    const minScore = regenerate ? 0.35 : 0.2
    const top3 = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => ({ ...s, detail: details[s.index] }))
      .filter(s => s.detail && s.score >= minScore)

    if (top3.length === 0) return { exercise: ex.name_display, status: 'no_good_matches', usedFallback }

    const inserts = top3.map(s => ({
      exercise_id:        ex.id,
      youtube_video_id:   s.detail.videoId,
      url:                s.detail.url,
      title:              s.detail.title,
      channel_id:         s.detail.channelId,
      channel_title:      s.detail.channelTitle,
      thumbnail_url:      s.detail.thumbnail,
      duration_seconds:   s.detail.duration,
      view_count:         s.detail.viewCount,
      ai_relevance_score: s.score,
      ai_reasoning:       s.reasoning,
      status:             'proposed',
    }))

    await supabaseAdmin.from('exercise_video_candidates').insert(inserts)
    return {
      exercise: ex.name_display, status: 'proposed', candidates: top3.length,
      usedFallback, matchScore: Number(local.topScore.toFixed(2)),
      source: usedFallback ? 'search fallback (100 units)' : 'local cache (0 units)',
    }
  } catch (err) {
    return { exercise: ex.name_display, status: 'error', error: err instanceof Error ? err.message : 'unknown' }
  }
}

// Process exercises 4 at a time in parallel to stay within function timeout
async function processExercises(
  exercises: Exercise[], channels: Channel[], regenerate = false, batchId = '',
  threshold = DEFAULT_MATCH_THRESHOLD, fallbackCap = DEFAULT_FALLBACK_CAP,
) {
  // One shared budget across the whole request, seeded from what today already
  // spent, so the cap is a real daily ceiling rather than a per-request one.
  const spentToday = await fallbackCallsToday()
  const fallbackBudget = { remaining: Math.max(0, fallbackCap - spentToday) }
  const ctx: CurationCtx = { regenerate, batchId, threshold, fallbackBudget, channels }

  const results = []
  const CONCURRENCY = 4
  for (let i = 0; i < exercises.length; i += CONCURRENCY) {
    const chunk = exercises.slice(i, i + CONCURRENCY)
    results.push(...await Promise.all(chunk.map(ex => processOne(ex, ctx))))
  }
  return results
}

// Midnight Pacific is when YouTube resets the daily quota.
async function fallbackCallsToday(): Promise<number> {
  const now = new Date()
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const midnightPT = new Date(now.getTime() - (pacific.getHours() * 3600 + pacific.getMinutes() * 60 + pacific.getSeconds()) * 1000)
  const { count } = await supabaseAdmin
    .from('youtube_api_usage')
    .select('id', { count: 'exact', head: true })
    .eq('is_fallback', true)
    .eq('endpoint', 'search')
    .gte('created_at', midnightPT.toISOString())
  return count ?? 0
}
