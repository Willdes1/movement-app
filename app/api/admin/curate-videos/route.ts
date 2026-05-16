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
async function searchChannel(channelId: string, query: string): Promise<string[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=3&key=${YT_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.items ?? []).map((i: { id: { videoId: string } }) => i.id.videoId).filter(Boolean)
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
async function scoreCandidates(exerciseName: string, exerciseHow: string, candidates: VideoDetail[]) {
  if (candidates.length === 0) return []

  const candidateList = candidates.map((c, i) =>
    `[${i}] "${c.title}" by ${c.channelTitle} (${Math.round(c.viewCount / 1000)}K views, ${Math.round(c.duration / 60)} min)`
  ).join('\n')

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

Pick the best 3 (or fewer if less than 3 are relevant). For each, give a relevance score 0.0–1.0 and one sentence of reasoning.

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
    const { exerciseId, batchSize = 10 } = await request.json().catch(() => ({}))

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
      // Skip exercises that already have proposed candidates
      const { data: existing } = await supabaseAdmin
        .from('exercise_video_candidates')
        .select('exercise_id')
        .eq('status', 'proposed')
      const skip = new Set((existing ?? []).map((r: { exercise_id: string }) => r.exercise_id))

      query = supabaseAdmin
        .from('exercise_library')
        .select('id, name_display, how, name_normalized')
        .is('video_url', null)
        .order('name_display')
        .limit(batchSize + skip.size)

      const { data: all } = await query
      const filtered = (all ?? []).filter((e: { id: string }) => !skip.has(e.id)).slice(0, batchSize)

      const results = await processExercises(filtered, channels)
      return Response.json({ processed: results.length, results })
    }

    const { data: exercises } = await query
    const results = await processExercises(exercises ?? [], channels)
    return Response.json({ processed: results.length, results })

  } catch (err) {
    console.error('Curation error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Curation failed' }, { status: 500 })
  }
}

type Channel = { channel_id: string; channel_name: string; audience_focus: string; priority: number }
type Exercise = { id: string; name_display: string; how: string | null; name_normalized: string }

async function processExercises(exercises: Exercise[], channels: Channel[]) {
  const results = []

  for (const ex of exercises) {
    try {
      const searchQuery = ex.name_display

      // Search across all active channels, collect video IDs
      const allVideoIds: string[] = []
      for (const ch of channels.slice(0, 4)) { // limit to top 4 channels per exercise to save quota
        const ids = await searchChannel(ch.channel_id, searchQuery)
        allVideoIds.push(...ids)
        if (allVideoIds.length >= 8) break
      }

      const unique = [...new Set(allVideoIds)]
      const details = await getVideoDetails(unique.slice(0, 8))

      if (details.length === 0) {
        results.push({ exercise: ex.name_display, status: 'no_results' })
        continue
      }

      // Score with Claude
      const scored = await scoreCandidates(ex.name_display, ex.how ?? '', details)
      const top3 = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(s => ({ ...s, detail: details[s.index] }))
        .filter(s => s.detail && s.score >= 0.4)

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
