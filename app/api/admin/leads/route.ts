import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'

// List / update / delete leads. All gated on the 'marketing' admin tab.
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const type = url.searchParams.get('type')
  const industry = url.searchParams.get('industry')
  const minScore = Number(url.searchParams.get('minScore') ?? 0)
  const q = url.searchParams.get('q')?.trim()

  let query = auth.supabase.from('leads').select('*').order('lead_score', { ascending: false }).limit(500)
  if (status && status !== 'all') query = query.eq('status', status)
  if (type && type !== 'all') query = query.eq('business_type', type)
  if (industry && industry !== 'all') query = query.eq('category', industry)
  if (minScore > 0) query = query.gte('lead_score', minScore)
  if (q) query = query.ilike('business_name', `%${q}%`)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ leads: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  if (!b.id) return Response.json({ error: 'id required' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.status === 'string') patch.status = b.status
  if (typeof b.notes === 'string') patch.notes = b.notes
  if (typeof b.email === 'string') patch.email = b.email
  if (typeof b.owner_name === 'string') patch.owner_name = b.owner_name

  const { data, error } = await auth.supabase.from('leads').update(patch).eq('id', b.id).select().maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lead: data })
}

export async function DELETE(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const { error } = await auth.supabase.from('leads').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
