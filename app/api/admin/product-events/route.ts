import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

type Row = { event_name: string; path: string | null; user_id: string | null; role: string | null; created_at: string }

// Aggregated product telemetry for the Telemetry tab's "Product" view.
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'telemetry')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await auth.supabase
    .from('product_events')
    .select('event_name, path, user_id, role, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    if (/does not exist|schema cache|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ pendingMigration: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Row[]
  const tally = (items: (string | null)[]) => {
    const m = new Map<string, number>()
    for (const it of items) { if (!it) continue; m.set(it, (m.get(it) ?? 0) + 1) }
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
  }

  const dayKey = (iso: string) => iso.slice(0, 10)
  const todayKey = new Date().toISOString().slice(0, 10)

  // Daily counts for the last 7 days (oldest → newest).
  const byDay = new Map<string, number>()
  for (let i = 6; i >= 0; i--) byDay.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), 0)
  for (const r of rows) { const k = dayKey(r.created_at); if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1) }

  return NextResponse.json({
    total: rows.length,
    uniqueUsers: new Set(rows.map(r => r.user_id).filter(Boolean)).size,
    pageViewsToday: rows.filter(r => r.event_name === 'page_view' && dayKey(r.created_at) === todayKey).length,
    byEvent: tally(rows.map(r => r.event_name)).slice(0, 12),
    byPath: tally(rows.filter(r => r.event_name === 'page_view').map(r => r.path)).slice(0, 12),
    byRole: tally(rows.map(r => r.role)),
    daily: [...byDay.entries()].map(([day, count]) => ({ day, count })),
    recent: rows.slice(0, 40).map(r => ({ event_name: r.event_name, path: r.path, role: r.role, created_at: r.created_at })),
  })
}
