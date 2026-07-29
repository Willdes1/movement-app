import { ytFetch, beginYtBatch } from '@/lib/youtube'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1: add approved channels by handle, at 1 quota unit each.
//
//  This is the cheap answer to "can we search the whole of YouTube". The API
//  offers exactly one way to search everything, search.list, at 100 units for
//  about 5 results. Indexing a channel's uploads costs 1 unit per 50 videos.
//  Per video that is roughly a thousand times cheaper.
//
//  So the strategy is not to search more of YouTube, it is to INDEX more of it.
//  Measured on this project: 9 channels produced 18,300 cached videos for 372
//  units. The same 372 units of search.list would have bought about 18 results.
//
//  Note this route also replaces how channels get added. discover-channels
//  burns 500 units per run on search.list AND produced the six mangled ids we
//  just had to repair. Handle lookups are 1 unit and exact.
// ─────────────────────────────────────────────────────────────────────────────

type ChannelItem = {
  id: string
  snippet?: { title?: string; description?: string }
  statistics?: { videoCount?: string; subscriberCount?: string }
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const raw: string = String(body.handles ?? '')
  const handles = raw
    .split(/[\s,\n]+/)
    .map(h => h.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/^@/, ''))
    .filter(Boolean)
    .slice(0, 40)

  if (!handles.length) return Response.json({ error: 'No handles supplied' }, { status: 400 })

  const batchId = beginYtBatch()
  const supabase = auth.supabase
  let unitsSpent = 0

  const { data: existing } = await supabase
    .from('approved_yt_channels')
    .select('channel_id, priority')
  const existingIds = new Set((existing ?? []).map((c: { channel_id: string }) => c.channel_id))
  let nextPriority = Math.max(0, ...(existing ?? []).map((c: { priority: number }) => c.priority ?? 0)) + 1

  const added: { handle: string; name: string; channel_id: string; videos: number; index_units: number }[] = []
  const skipped: { handle: string; reason: string }[] = []

  for (const handle of handles) {
    const { data, error } = await ytFetch(
      'channels',
      { part: 'id,snippet,statistics,contentDetails', forHandle: `@${handle}` },
      { batchId },
    )
    unitsSpent += 1

    if (error) { skipped.push({ handle, reason: error }); continue }
    const item = (data?.items ?? [])[0] as ChannelItem | undefined
    if (!item?.id) { skipped.push({ handle, reason: 'handle did not resolve' }); continue }
    if (existingIds.has(item.id)) { skipped.push({ handle, reason: 'already approved' }); continue }

    const videos = parseInt(item.statistics?.videoCount ?? '0', 10)
    const uploads = item.contentDetails?.relatedPlaylists?.uploads ?? null

    const { error: insErr } = await supabase.from('approved_yt_channels').upsert({
      channel_id:          item.id,
      channel_name:        item.snippet?.title ?? handle,
      audience_focus:      (item.snippet?.description ?? '').slice(0, 200),
      priority:            nextPriority,
      active:              true,
      uploads_playlist_id: uploads,
    }, { onConflict: 'channel_id' })

    if (insErr) { skipped.push({ handle, reason: `db: ${insErr.message}` }); continue }

    existingIds.add(item.id)
    nextPriority += 1
    added.push({
      handle,
      name: item.snippet?.title ?? handle,
      channel_id: item.id,
      videos,
      index_units: Math.ceil(videos / 50),
    })
  }

  const indexUnits = added.reduce((s, a) => s + a.index_units, 0)

  return Response.json({
    units_spent: unitsSpent,
    added,
    skipped,
    new_videos_available: added.reduce((s, a) => s + a.videos, 0),
    estimated_index_units: indexUnits,
    estimated_index_pct_of_day: Number(((indexUnits / 10000) * 100).toFixed(1)),
    next_step: added.length ? 'Run Build index to cache the newly added channels.' : undefined,
    curation_batch_id: batchId,
  })
}
