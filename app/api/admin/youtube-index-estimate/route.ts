import { ytFetch, beginYtBatch } from '@/lib/youtube'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1: one-time cost estimate for building the cached uploads index.
//
//  Costs 1 quota unit per 50 approved channels. channels.list accepts up to 50
//  IDs and returns, for all of them in a single call:
//    contentDetails.relatedPlaylists.uploads  -> the uploads playlist id
//    statistics.videoCount                    -> how many uploads to page through
//
//  Index build cost = sum over channels of ceil(videoCount / 50), because
//  playlistItems.list returns 50 items per call at 1 unit each.
//
//  Runs BEFORE any migration. Nothing is written; this is read-only.
//
//  Caveat: statistics.videoCount excludes some private/unlisted uploads, so the
//  real playlist length can differ slightly. Good estimate, not exact.
// ─────────────────────────────────────────────────────────────────────────────

type ChannelRaw = {
  id: string
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
  statistics?: { videoCount?: string }
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const batchId = beginYtBatch()

  const { data: channels } = await auth.supabase
    .from('approved_yt_channels')
    .select('channel_id, channel_name')
    .eq('active', true)
    .order('priority')

  if (!channels?.length) return Response.json({ error: 'No active approved channels' }, { status: 400 })

  const ids: string[] = channels.map((c: { channel_id: string }) => c.channel_id)
  const nameById = new Map(channels.map((c: { channel_id: string; channel_name: string }) => [c.channel_id, c.channel_name]))

  const found = new Map<string, { uploadsPlaylistId: string | null; videoCount: number }>()
  let unitsSpent = 0
  const errors: string[] = []

  // 50 IDs per call, 1 unit per call.
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const { data, error } = await ytFetch(
      'channels',
      { part: 'contentDetails,statistics', id: chunk.join(','), maxResults: 50 },
      { batchId },
    )
    unitsSpent += 1
    if (error || data?.error) {
      errors.push(data?.error?.errors?.[0]?.reason ?? data?.error?.message ?? error ?? 'unknown')
      continue
    }
    for (const c of (data?.items ?? []) as ChannelRaw[]) {
      found.set(c.id, {
        uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
        videoCount: parseInt(c.statistics?.videoCount ?? '0', 10),
      })
    }
  }

  const perChannel = ids.map(id => {
    const hit = found.get(id)
    const videoCount = hit?.videoCount ?? 0
    return {
      channel_id: id,
      channel_name: nameById.get(id) ?? '',
      uploads_playlist_id: hit?.uploadsPlaylistId ?? null,
      video_count: videoCount,
      // playlistItems.list returns 50 per page at 1 unit per page.
      build_units: Math.ceil(videoCount / 50),
      resolved: !!hit,
    }
  }).sort((a, b) => b.build_units - a.build_units)

  const buildUnits = perChannel.reduce((s, c) => s + c.build_units, 0)
  const totalVideos = perChannel.reduce((s, c) => s + c.video_count, 0)
  const unresolved = perChannel.filter(c => !c.resolved).map(c => c.channel_id)

  return Response.json({
    channels_active: ids.length,
    channels_resolved: found.size,
    unresolved,
    total_videos: totalVideos,
    // The one-time cost of building the index from empty.
    one_time_build_units: buildUnits,
    // Incremental refresh stops at the first known video, so it is normally a
    // single page per channel per run.
    daily_refresh_units_estimate: ids.length,
    // What this estimate itself cost.
    units_spent_on_this_estimate: unitsSpent,
    percent_of_daily_quota: Number(((buildUnits / 10000) * 100).toFixed(1)),
    per_channel: perChannel,
    errors: errors.length ? errors : undefined,
    note: 'statistics.videoCount excludes some private/unlisted uploads, so the real playlist length can differ slightly.',
    curation_batch_id: batchId,
  })
}
