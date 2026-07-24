import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'

// List / update / delete ad campaigns. Gated on the 'marketing' admin tab.
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.supabase.from('ad_campaigns').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ campaigns: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return Response.json({ error: 'id required' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.status === 'string') patch.status = b.status
  if (typeof b.notes === 'string') patch.notes = b.notes
  const { data, error } = await auth.supabase.from('ad_campaigns').update(patch).eq('id', b.id).select().maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ campaign: data })
}

export async function DELETE(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const { error } = await auth.supabase.from('ad_campaigns').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
