import { verifyAdmin } from '@/lib/admin-auth'
import { CONTENT_CLUSTERS } from '@/lib/content-clusters'

export const runtime = 'nodejs'

const DEFAULTS = {
  auto_generate: true,
  publish_days: [2, 5],           // Tue + Fri
  queue_target: 4,
  clusters: CONTENT_CLUSTERS.map(c => c.id),
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data } = await auth.supabase.from('content_settings').select('*').eq('id', 'default').maybeSingle()
  return Response.json({ settings: data ?? { id: 'default', ...DEFAULTS } })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const row = {
    id: 'default',
    auto_generate: typeof b.auto_generate === 'boolean' ? b.auto_generate : DEFAULTS.auto_generate,
    publish_days: Array.isArray(b.publish_days) ? b.publish_days.filter((n: number) => n >= 0 && n <= 6) : DEFAULTS.publish_days,
    queue_target: Number.isFinite(b.queue_target) ? Math.max(1, Math.min(20, b.queue_target)) : DEFAULTS.queue_target,
    clusters: Array.isArray(b.clusters) && b.clusters.length ? b.clusters : DEFAULTS.clusters,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await auth.supabase.from('content_settings').upsert(row).select().maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ settings: data })
}
