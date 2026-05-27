import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const YT_KEY = process.env.YOUTUBE_API_KEY!

// ─── YouTube helpers ──────────────────────────────────────────────────────────
async function searchChannel(channelId: string, query: string): Promise<{ ids: string[]; error?: string }> {
  // No videoEmbeddable filter here — getVideoDetails already gates on embeddability.
  // Including it at search time silently drops valid candidates.
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&q=${encodeURIComponent(query)}&type=video&maxResults=3&key=${YT_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) {
    const reason = data.error.errors?.[0]?.reason ?? data.error.message ?? 'unknown'
    return { ids: [], error: `YT API error (${data.error.code}): ${reason}` }
  }
  const ids = (data.items ?? []).map((i: { id: { videoId: string } }) => i.id.videoId).filter(Boolean)
  return { ids }
}

async function searchGeneral(query: string): Promise<{ ids: string[]; error?: string }> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(query + ' exercise tutorial')}&type=video&maxResults=5&key=${YT_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) {
    const reason = data.error.errors?.[0]?.reason ?? data.error.message ?? 'unknown'
    return { ids: [], error: `YT API error (${data.error.code}): ${reason}` }
  }
  const ids = (data.items ?? []).map((i: { id: { videoId: string } }) => i.id.videoId).filter(Boolean)
  return { ids }
}

async function getVideoDetails(videoIds: string[]): Promise<VideoDetail[]> {
  if (videoIds.length === 0) return []
  const ids = videoIds.join(',')
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${ids}&key=${YT_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.items ?? [])
    .filter((v: { status: { embeddable: boolean } }) => v.status?.embeddable)
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
    const { exerciseId, batchSize = 10, regenerate = false } = await request.json().catch(() => ({}))

    // Load approved channels
    const { data: channels } = await supabaseAdmin
      .from('approved_yt_channels')
      .select('channel_id, channel_name, audience_focus, priority')
      .eq('active', true)
      .order('priority')

    if (!channels?.length) return Response.json({ error: 'No approved channels configured' }, { status: 400 })

    // Load exercises to process
    let query = supabaseAdmin
      .from('exercise_library')
      .select('id, name_display, how, name_normalized')
      .is('video_url', null)
      .order('name_display')

    if (exerciseId) {
      query = supabaseAdmin.from('exercise_library').select('id, name_display, how, name_normalized').eq('id', exerciseId)
    } else {
      // Get candidate statuses in one query
      const { data: existingCands } = await supabaseAdmin
        .from('exercise_video_candidates')
        .select('exercise_id, status')
        .in('status', ['proposed', 'queued'])

      const skip    = new Set<string>()
      const queued  = new Set<string>()
      for (const r of (existingCands ?? [])) {
        if (r.status === 'proposed') skip.add(r.exercise_id)
        if (r.status === 'queued')   queued.add(r.exercise_id)
      }

      // Fetch all unprocessed exercises (no video, not already proposed)
      const { data: all } = await supabaseAdmin
        .from('exercise_library')
        .select('id, name_display, how, name_normalized')
        .is('video_url', null)
        .order('name_display')

      const available = (all ?? []).filter((e: Exercise) => !skip.has(e.id))

      // Prioritise exercises queued from real client plans, then alphabetical
      const sorted = [
        ...available.filter((e: Exercise) => queued.has(e.id)),
        ...available.filter((e: Exercise) => !queued.has(e.id)),
      ]

      const filtered = sorted.slice(0, batchSize)
      const results = await processExercises(filtered, channels, regenerate)
      return Response.json({ processed: results.length, results })
    }

    const { data: exercises } = await query
    const results = await processExercises(exercises ?? [], channels, regenerate)
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

// Returns 2–4 query variations for regeneration: broader terms get more diverse YouTube results
function buildAlternativeQueries(name: string): string[] {
  const primary = buildSearchQuery(name)
  const queries: string[] = [primary]

  // Strip directional/side qualifiers e.g. "Toe-Side to Heel-Side", "Lateral to Medial"
  const noDirectional = primary
    .replace(/\b\w+-Side(\s+to\s+\w+-Side)?\b/gi, '')
    .replace(/\b(clockwise|counterclockwise|lateral|medial|bilateral|unilateral|alternating|contralateral)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (noDirectional && noDirectional !== primary) queries.push(noDirectional)

  // Core 2-word movement name (e.g., "Ankle Circles" from "Ankle Circles Toe-Side to Heel-Side")
  const words = primary.split(' ')
  if (words.length > 3) queries.push(words.slice(0, 2).join(' ') + ' exercise tutorial')
  else if (words.length === 3) queries.push(words.slice(0, 2).join(' '))

  // "How to" prefix for tutorial-focused results
  const base = noDirectional || primary
  queries.push('how to ' + base.toLowerCase().split(' ').slice(0, 4).join(' '))

  return [...new Set(queries)].filter(q => q.length >= 5)
}

async function processExercises(exercises: Exercise[], channels: Channel[], regenerate = false) {
  const results = []

  for (const ex of exercises) {
    try {
      const apiErrors: string[] = []
      const allVideoIds: string[] = []

      if (regenerate) {
        // Regenerate: try multiple query variations across ALL approved channels
        const queries = buildAlternativeQueries(ex.name_display)
        const channelPool = channels  // all channels, not just top 2

        for (const q of queries) {
          for (const ch of channelPool) {
            const { ids, error } = await searchChannel(ch.channel_id, q)
            if (error) apiErrors.push(error)
            allVideoIds.push(...ids)
          }
          if (allVideoIds.length >= 9) break
        }

        // Broader fallback: try each query variant against general YouTube
        if (allVideoIds.length < 3) {
          for (const q of queries) {
            const { ids, error } = await searchGeneral(q)
            if (error) apiErrors.push(error)
            allVideoIds.push(...ids)
            if (allVideoIds.length >= 8) break
          }
        }
      } else {
        // Normal path: single query, top 2 channels
        const searchQuery = buildSearchQuery(ex.name_display)

        for (const ch of channels.slice(0, 2)) {
          const { ids, error } = await searchChannel(ch.channel_id, searchQuery)
          if (error) apiErrors.push(error)
          allVideoIds.push(...ids)
          if (allVideoIds.length >= 6) break
        }

        if (allVideoIds.length === 0) {
          const { ids: fallbackIds, error } = await searchGeneral(searchQuery)
          if (error) apiErrors.push(error)
          allVideoIds.push(...fallbackIds)
        }
      }

      const unique = [...new Set(allVideoIds)]
      const details = await getVideoDetails(unique.slice(0, 12))

      if (details.length === 0) {
        const errSuffix = apiErrors.length ? ` [${apiErrors[0]}]` : ''
        results.push({ exercise: ex.name_display, status: 'no_results', error: errSuffix || undefined })
        continue
      }

      // Score with Claude (strict mode on regenerate to avoid low-quality approvals)
      const scored = await scoreCandidates(ex.name_display, ex.how ?? '', details, regenerate)
      const minScore = regenerate ? 0.35 : 0.2
      const top3 = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(s => ({ ...s, detail: details[s.index] }))
        .filter(s => s.detail && s.score >= minScore)

      if (top3.length === 0) {
        results.push({ exercise: ex.name_display, status: 'no_good_matches' })
        continue
      }

      // Write candidates to DB
      const inserts = top3.map(s => ({
        exercise_id:         ex.id,
        youtube_video_id:    s.detail.videoId,
        url:                 s.detail.url,
        title:               s.detail.title,
        channel_id:          s.detail.channelId,
        channel_title:       s.detail.channelTitle,
        thumbnail_url:       s.detail.thumbnail,
        duration_seconds:    s.detail.duration,
        view_count:          s.detail.viewCount,
        ai_relevance_score:  s.score,
        ai_reasoning:        s.reasoning,
        status:              'proposed',
      }))

      await supabaseAdmin.from('exercise_video_candidates').insert(inserts)
      results.push({ exercise: ex.name_display, status: 'proposed', candidates: top3.length })
    } catch (err) {
      results.push({ exercise: ex.name_display, status: 'error', error: err instanceof Error ? err.message : 'unknown' })
    }
  }

  return results
}
