import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

// GET /api/admin/study/entries?kbId=... — list entries for one knowledge base
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const kbId = new URL(req.url).searchParams.get('kbId')
  if (!kbId) return NextResponse.json({ error: 'kbId is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('study_entries')
    .select('*')
    .eq('kb_id', kbId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

// PATCH /api/admin/study/entries — update an entry (id in body): status, tags, title
export async function PATCH(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['status', 'tags', 'title', 'topic'] as const) {
    if (k in body) patch[k] = body[k]
  }

  const { data, error } = await supabase.from('study_entries').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

// DELETE /api/admin/study/entries — delete an entry (id in body)
export async function DELETE(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('study_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
