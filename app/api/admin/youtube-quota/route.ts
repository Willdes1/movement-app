import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
//  Task 1 item 4: live quota meter.
//
//  YouTube resets the daily quota at midnight Pacific, so every window here is
//  computed in America/Los_Angeles rather than UTC or server-local time.
//
//  Reads youtube_api_usage, which lib/youtube.ts writes for every single call,
//  so this reflects real spend rather than an estimate.
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_QUOTA = 10_000

function midnightPacific(): Date {
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const elapsedMs = (pt.getHours() * 3600 + pt.getMinutes() * 60 + pt.getSeconds()) * 1000 + pt.getMilliseconds()
  return new Date(now.getTime() - elapsedMs)
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const since = midnightPacific()
  const reset = new Date(since.getTime() + 24 * 3600 * 1000)

  const { data, error } = await auth.supabase
    .from('youtube_api_usage')
    .select('endpoint, unit_cost, is_fallback, success')
    .gte('created_at', since.toISOString())
    .limit(10000)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as { endpoint: string; unit_cost: number; is_fallback: boolean; success: boolean }[]
  const used = rows.reduce((s, r) => s + (r.unit_cost ?? 0), 0)
  const remaining = Math.max(0, DAILY_QUOTA - used)

  const byEndpoint: Record<string, { calls: number; units: number }> = {}
  for (const r of rows) {
    const e = byEndpoint[r.endpoint] ?? { calls: 0, units: 0 }
    e.calls += 1
    e.units += r.unit_cost ?? 0
    byEndpoint[r.endpoint] = e
  }

  const fallbackCalls = rows.filter(r => r.is_fallback && r.endpoint === 'search').length

  return Response.json({
    daily_quota: DAILY_QUOTA,
    used,
    remaining,
    used_pct: Number(((used / DAILY_QUOTA) * 100).toFixed(1)),
    by_endpoint: Object.entries(byEndpoint)
      .map(([endpoint, v]) => ({ endpoint, ...v }))
      .sort((a, b) => b.units - a.units),
    fallback_calls_today: fallbackCalls,
    // Locally matched videos cost only their share of a batched videos.list
    // call, so the ceiling is set by how many paid searches are still
    // affordable. Both numbers are shown because they differ by 100x.
    videos_remaining_via_fallback: Math.floor(remaining / 100),
    videos_remaining_via_cache: remaining > 0 ? 'effectively unlimited' : 0,
    resets_at_pacific: reset.toISOString(),
    hours_until_reset: Number(((reset.getTime() - Date.now()) / 3_600_000).toFixed(1)),
    failures_today: rows.filter(r => !r.success).length,
  })
}
