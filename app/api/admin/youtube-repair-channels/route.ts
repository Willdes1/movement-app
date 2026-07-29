import { ytFetch, beginYtBatch } from '@/lib/youtube'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1: repair approved channels whose stored channel_id no longer resolves.
//
//  6 of 9 approved channels return nothing from channels.list. They are all
//  real, large channels (Squat University, Bob & Brad, E3 Rehab, Prehab Guys,
//  Knees Over Toes Guy, Calisthenicmovement), so the stored ids are wrong
//  rather than the channels being gone. One is 23 characters where YouTube ids
//  are always 24.
//
//  This matters more than any scoring tweak: those six are the entire rehab and
//  mobility corpus. The dry run found nothing for Cat-Cow Stretch, 90/90 Hip
//  Stretch and similar precisely because the only indexed channels are
//  bodybuilding ones.
//
//  Strategy, cheapest first:
//    1. channels.list?forHandle=@Name  -> 1 unit per attempt
//    2. search.list (100 units) ONLY when explicitly allowed, and capped.
//
//  Updating channel_id is safe here: these channels have zero cached videos, so
//  nothing in youtube_channel_videos references them. The FK is ON DELETE
//  CASCADE with no ON UPDATE clause, which would block a key change that had
//  children.
// ─────────────────────────────────────────────────────────────────────────────

type Ch = { channel_id: string; channel_name: string; uploads_playlist_id: string | null }

/** Plausible YouTube handles for a display name, cheapest guesses first. */
function handleVariants(name: string): string[] {
  const strip = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '')
  const base = (name ?? '').trim()
  const anded = base.replace(/&/g, 'and')
  const variants = [
    strip(base),
    strip(anded),
    strip(base.replace(/^the\s+/i, '')),
    strip(anded.replace(/^the\s+/i, '')),
    strip(`The${base}`),
  ]
  return [...new Set(variants)].filter(v => v.length >= 3).slice(0, 5)
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const allowSearch: boolean = body.allowSearch === true
  const searchCap: number = Math.min(Math.max(Number(body.searchCap ?? 3), 0), 10)

  const batchId = beginYtBatch()
  const supabase = auth.supabase
  let unitsSpent = 0

  const { data: channels } = await supabase
    .from('approved_yt_channels')
    .select('channel_id, channel_name, uploads_playlist_id')
    .eq('active', true)
    .order('priority')
  if (!channels?.length) return Response.json({ error: 'No active approved channels' }, { status: 400 })

  const list = channels as Ch[]

  // ── Which ids currently resolve? (1 unit per 50) ──────────────────────────
  const resolved = new Set<string>()
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50)
    const { data } = await ytFetch(
      'channels',
      { part: 'id', id: chunk.map(c => c.channel_id).join(','), maxResults: 50 },
      { batchId },
    )
    unitsSpent += 1
    for (const c of (data?.items ?? []) as { id: string }[]) resolved.add(c.id)
  }

  const broken = list.filter(c => !resolved.has(c.channel_id))
  if (!broken.length) {
    return Response.json({ units_spent: unitsSpent, broken: 0, message: 'All channel ids resolve. Nothing to repair.' })
  }

  const repaired: { name: string; old_id: string; new_id: string; via: string; uploads: string | null }[] = []
  const stillBroken: { name: string; old_id: string; tried: string[] }[] = []
  let searchesUsed = 0

  for (const ch of broken) {
    let found: { id: string; uploads: string | null } | null = null
    const tried: string[] = []

    // 1. Handle lookups, 1 unit each.
    for (const handle of handleVariants(ch.channel_name)) {
      tried.push(`@${handle}`)
      const { data } = await ytFetch(
        'channels',
        { part: 'id,contentDetails', forHandle: `@${handle}` },
        { batchId },
      )
      unitsSpent += 1
      const item = (data?.items ?? [])[0] as { id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } } | undefined
      if (item?.id) {
        found = { id: item.id, uploads: item.contentDetails?.relatedPlaylists?.uploads ?? null }
        tried.push(`resolved via @${handle}`)
        break
      }
    }

    // 2. Paid fallback, only if explicitly allowed and under the cap.
    if (!found && allowSearch && searchesUsed < searchCap) {
      searchesUsed += 1
      tried.push('search.list (100 units)')
      const { data } = await ytFetch(
        'search',
        { part: 'id', type: 'channel', q: ch.channel_name, maxResults: 1 },
        { batchId, isFallback: true },
      )
      unitsSpent += 100
      const id = (data?.items ?? [])[0]?.id?.channelId as string | undefined
      if (id) {
        const { data: detail } = await ytFetch('channels', { part: 'contentDetails', id }, { batchId })
        unitsSpent += 1
        const uploads = ((detail?.items ?? [])[0] as { contentDetails?: { relatedPlaylists?: { uploads?: string } } } | undefined)
          ?.contentDetails?.relatedPlaylists?.uploads ?? null
        found = { id, uploads }
      }
    }

    if (found) {
      const { error } = await supabase
        .from('approved_yt_channels')
        .update({ channel_id: found.id, uploads_playlist_id: found.uploads })
        .eq('channel_id', ch.channel_id)
      if (error) stillBroken.push({ name: ch.channel_name, old_id: ch.channel_id, tried: [...tried, `db update failed: ${error.message}`] })
      else repaired.push({ name: ch.channel_name, old_id: ch.channel_id, new_id: found.id, via: tried[tried.length - 1], uploads: found.uploads })
    } else {
      stillBroken.push({ name: ch.channel_name, old_id: ch.channel_id, tried })
    }
  }

  return Response.json({
    units_spent: unitsSpent,
    broken: broken.length,
    repaired,
    still_broken: stillBroken,
    search_fallback_used: searchesUsed,
    next_step: repaired.length ? 'Run Build index to cache the newly resolved channels.' : undefined,
    curation_batch_id: batchId,
  })
}
