import { ytFetch, beginYtBatch, isQuotaTripped } from '@/lib/youtube'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1: build and refresh the cached channel uploads index.
//
//  This is what replaces search.list discovery. playlistItems.list returns 50
//  uploads per call at 1 unit, so caching a whole channel costs about
//  ceil(uploadCount / 50) units ONCE, after which matching is local and free.
//  Compare against 100 units per search.list call, every single time.
//
//  Two modes:
//    build   - page a channel's uploads from newest to oldest until exhausted.
//              Resumable: hand back the pageToken and call again.
//    refresh - page newest-first and STOP at the first video already cached.
//              Normally one page per channel, so about 1 unit per channel.
//
//  Time-budgeted rather than fixed-size, matching the TTS route: stop launching
//  new pages once we are close to the Vercel wall, and report where to resume.
//  Every call is logged to youtube_api_usage by the wrapper.
// ─────────────────────────────────────────────────────────────────────────────

const TIME_BUDGET_MS = 45_000   // stop launching new pages past this
const PAGE_SIZE = 50            // playlistItems.list maximum

type PlaylistItem = {
  snippet?: { title?: string; description?: string; resourceId?: { videoId?: string } }
  contentDetails?: { videoId?: string; videoPublishedAt?: string }
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const started = Date.now()
  const timeLeft = () => TIME_BUDGET_MS - (Date.now() - started)

  const body = await req.json().catch(() => ({}))
  const mode: 'build' | 'refresh' = body.mode === 'build' ? 'build' : 'refresh'
  const resumeChannelId: string | null = body.resumeChannelId ?? null
  const resumePageToken: string | null = body.resumePageToken ?? null

  const batchId = beginYtBatch()
  const supabase = auth.supabase

  const { data: channels } = await supabase
    .from('approved_yt_channels')
    .select('channel_id, channel_name, uploads_playlist_id')
    .eq('active', true)
    .order('priority')

  if (!channels?.length) return Response.json({ error: 'No active approved channels' }, { status: 400 })

  type Ch = { channel_id: string; channel_name: string; uploads_playlist_id: string | null }
  let list = channels as Ch[]

  let unitsSpent = 0
  let videosUpserted = 0
  let pagesFetched = 0
  const perChannel: Record<string, number> = {}
  const errors: string[] = []

  // ── Step 1: resolve any missing uploads playlist ids (1 unit per 50) ───────
  const missing = list.filter(c => !c.uploads_playlist_id).map(c => c.channel_id)
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50)
    const { data, error } = await ytFetch(
      'channels',
      { part: 'contentDetails', id: chunk.join(','), maxResults: 50 },
      { batchId },
    )
    unitsSpent += 1
    if (error) { errors.push(`channels.list: ${error}`); break }
    for (const c of (data?.items ?? []) as { id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[]) {
      const uploads = c.contentDetails?.relatedPlaylists?.uploads
      if (!uploads) continue
      await supabase.from('approved_yt_channels').update({ uploads_playlist_id: uploads }).eq('channel_id', c.id)
      const hit = list.find(x => x.channel_id === c.id)
      if (hit) hit.uploads_playlist_id = uploads
    }
  }

  // If resuming, start from that channel and carry its page token.
  if (resumeChannelId) {
    const idx = list.findIndex(c => c.channel_id === resumeChannelId)
    if (idx > 0) list = list.slice(idx)
  }

  // ── Step 2: page uploads into the cache ───────────────────────────────────
  let resume: { channelId: string; pageToken: string } | null = null
  let done = true

  outer:
  for (const ch of list) {
    if (!ch.uploads_playlist_id) { errors.push(`${ch.channel_name}: no uploads playlist`); continue }

    // A full build re-pages a channel from scratch. Running it again over
    // channels that are already cached costs hundreds of units and adds
    // nothing: one such run wrote ~18,000 rows and produced 8 new videos.
    // So build only does the expensive full pass on channels with nothing
    // cached, and falls back to incremental refresh for the rest.
    let effectiveMode = mode
    if (mode === 'build' && ch.channel_id !== resumeChannelId) {
      const { count } = await supabase
        .from('youtube_channel_videos')
        .select('video_id', { count: 'exact', head: true })
        .eq('channel_id', ch.channel_id)
      if ((count ?? 0) > 0) effectiveMode = 'refresh'
    }

    let pageToken: string | null =
      (ch.channel_id === resumeChannelId ? resumePageToken : null)

    for (;;) {
      if (timeLeft() <= 0 || isQuotaTripped()) {
        done = false
        resume = pageToken ? { channelId: ch.channel_id, pageToken } : { channelId: ch.channel_id, pageToken: '' }
        break outer
      }

      const params: Record<string, string | number> = {
        part: 'snippet,contentDetails',
        playlistId: ch.uploads_playlist_id,
        maxResults: PAGE_SIZE,
      }
      if (pageToken) params.pageToken = pageToken

      const { data, error } = await ytFetch('playlistItems', params, { batchId })
      unitsSpent += 1
      pagesFetched += 1

      if (error) {
        errors.push(`${ch.channel_name}: ${error}`)
        // A stored uploads playlist that no longer exists (a repaired channel
        // id can land here) would fail forever. Clear it so the next run
        // re-resolves it from channels.list instead of retrying a dead id.
        if (error.includes('playlistNotFound')) {
          await supabase.from('approved_yt_channels')
            .update({ uploads_playlist_id: null }).eq('channel_id', ch.channel_id)
          errors.push(`${ch.channel_name}: cleared bad uploads playlist, will re-resolve next run`)
        }
        break
      }

      const items = (data?.items ?? []) as PlaylistItem[]
      if (!items.length) break

      const rows = items.map(it => ({
        video_id:     it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId ?? '',
        channel_id:   ch.channel_id,
        title:        it.snippet?.title ?? '',
        description:  it.snippet?.description ?? '',
        published_at: it.contentDetails?.videoPublishedAt ?? null,
        last_refreshed_at: new Date().toISOString(),
      })).filter(r => r.video_id)

      // Refresh mode stops at the first video we already hold. The uploads
      // playlist is newest-first, so everything past that point is known.
      let stopHere = false
      if (effectiveMode === 'refresh' && rows.length) {
        const { data: known } = await supabase
          .from('youtube_channel_videos')
          .select('video_id')
          .in('video_id', rows.map(r => r.video_id))
        const knownIds = new Set((known ?? []).map((k: { video_id: string }) => k.video_id))
        if (knownIds.size > 0) stopHere = true
      }

      if (rows.length) {
        const { error: upErr } = await supabase
          .from('youtube_channel_videos')
          .upsert(rows, { onConflict: 'video_id' })
        if (upErr) errors.push(`${ch.channel_name}: upsert ${upErr.message}`)
        else {
          videosUpserted += rows.length
          perChannel[ch.channel_name] = (perChannel[ch.channel_name] ?? 0) + rows.length
        }
      }

      pageToken = (data?.nextPageToken as string | undefined) ?? null
      if (!pageToken || stopHere) break
    }
  }

  // ── Step 3: prune cached rows for channels that are gone or deactivated ───
  // The foreign key only cascades on DELETE, and deactivating a channel is an
  // UPDATE, so this is what actually keeps the cache honest. It doubles as the
  // YouTube storage refresh/delete obligation.
  let pruned = 0
  if (done) {
    const activeIds = (channels as Ch[]).map(c => c.channel_id)
    const { data: stale } = await supabase
      .from('youtube_channel_videos')
      .select('video_id')
      .not('channel_id', 'in', `(${activeIds.map(id => `"${id}"`).join(',')})`)
      .limit(1000)
    if (stale?.length) {
      const ids = (stale as { video_id: string }[]).map(s => s.video_id)
      await supabase.from('youtube_channel_videos').delete().in('video_id', ids)
      pruned = ids.length
    }
  }

  const { count: cachedTotal } = await supabase
    .from('youtube_channel_videos')
    .select('video_id', { count: 'exact', head: true })

  return Response.json({
    mode,
    done,
    resume,
    quota_exhausted: isQuotaTripped(),
    units_spent: unitsSpent,
    pages_fetched: pagesFetched,
    videos_upserted: videosUpserted,
    pruned,
    cached_total: cachedTotal ?? null,
    per_channel: perChannel,
    elapsed_ms: Date.now() - started,
    errors: errors.length ? errors : undefined,
    curation_batch_id: batchId,
  })
}
