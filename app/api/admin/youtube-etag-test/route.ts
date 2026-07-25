import { ytFetch, beginYtBatch } from '@/lib/youtube'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Diagnostic for the "304 costs no quota" assumption (Task 1, item 4).
// Fetches one video (gets its ETag), then re-fetches it N times with
// If-None-Match so the calls return 304. Every call is logged to
// youtube_api_usage. To get the real answer, note your Google Cloud Console
// YouTube quota before and after and see whether the 304 repeats moved it.
//   GET /api/admin/youtube-etag-test?count=25[&videoId=...]
export async function GET(req: Request) {
  const url = new URL(req.url)
  const count = Math.max(1, Math.min(100, Number(url.searchParams.get('count') ?? 10)))
  let videoId = url.searchParams.get('videoId') ?? ''
  const batchId = beginYtBatch()

  if (!videoId) {
    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await supa.from('exercise_video_candidates').select('youtube_video_id').limit(1).maybeSingle()
    videoId = data?.youtube_video_id ?? 'M7lc1UVf-VE'
  }

  const first = await ytFetch('videos', { part: 'snippet', id: videoId }, { batchId, videoId })
  const etag = first.etag

  const repeats: { status: number; notModified: boolean }[] = []
  for (let i = 0; i < count; i++) {
    const r = await ytFetch('videos', { part: 'snippet', id: videoId }, { batchId, videoId, etag })
    repeats.push({ status: r.status, notModified: r.notModified })
  }

  const got304 = repeats.filter(r => r.notModified).length
  return Response.json({
    videoId,
    firstStatus: first.status,
    etag,
    repeatsRequested: count,
    repeats304: got304,
    curation_batch_id: batchId,
    howToRead: `Fired 1 full fetch + ${count} conditional fetches (${got304} returned 304). Compare your Google Cloud Console YouTube Data API quota before and after this request. If quota rose by ~${count} units, 304s DO count. If it rose by ~1 (just the first call), 304s are free.`,
  })
}
