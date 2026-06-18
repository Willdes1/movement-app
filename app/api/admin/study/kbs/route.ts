import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

// GET /api/admin/study/kbs — list all knowledge bases (with entry + mastery counts)
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const { data: kbs, error } = await supabase
    .from('study_kbs')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Roll up per-KB counts (one cheap query, grouped in JS).
  const { data: entries } = await supabase.from('study_entries').select('kb_id, status')
  const counts: Record<string, { total: number; mastered: number }> = {}
  for (const e of entries ?? []) {
    const c = (counts[e.kb_id] ??= { total: 0, mastered: 0 })
    if (e.status !== 'archived') c.total++
    if (e.status === 'mastered') c.mastered++
  }

  const withCounts = (kbs ?? []).map(kb => ({
    ...kb,
    entry_count: counts[kb.id]?.total ?? 0,
    mastered_count: counts[kb.id]?.mastered ?? 0,
  }))
  return NextResponse.json({ kbs: withCounts })
}

// POST /api/admin/study/kbs — create a knowledge base
export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, userId } = auth

  const body = await req.json().catch(() => ({}))
  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('study_kbs')
    .insert({
      owner_id: userId,
      title,
      domain: body.domain || 'general',
      description: body.description?.trim() || null,
      scope_prompt: body.scope_prompt?.trim() || null,
      cert_goal: body.cert_goal?.trim() || 'ISSA CFT',
      target_units: Number.isFinite(body.target_units) ? body.target_units : 25,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kb: { ...data, entry_count: 0, mastered_count: 0 } })
}

// PATCH /api/admin/study/kbs — update a knowledge base (id in body)
export async function PATCH(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['title', 'domain', 'description', 'scope_prompt', 'cert_goal', 'target_units'] as const) {
    if (k in body) patch[k] = body[k]
  }

  const { data, error } = await supabase.from('study_kbs').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kb: data })
}

// DELETE /api/admin/study/kbs — delete a knowledge base + its entries (id in body)
export async function DELETE(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // study_entries cascades via FK ON DELETE CASCADE.
  const { error } = await supabase.from('study_kbs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
