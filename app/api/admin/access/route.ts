import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { verifyOwner } from '@/lib/admin-auth'
import { sanitizeTabs } from '@/lib/admin-tabs'

export const runtime = 'nodejs'
export const maxDuration = 30

type ProfileRow = { id: string; name: string | null; role: string; is_admin: boolean; is_owner: boolean }
type PermRow = { user_id: string; allowed_tabs: string[]; active: boolean; note: string | null; granted_by: string | null; created_at: string; updated_at: string }

// Map auth user ids -> email (profiles doesn't store email).
async function emailMap(supabase: SupabaseClient): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  try {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) if (u.email) map[u.id] = u.email
  } catch { /* non-fatal — emails just won't show */ }
  return map
}

// GET — partners (with grants) + candidate users for the picker.
export async function GET(req: Request) {
  const auth = await verifyOwner(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const [{ data: profiles }, { data: perms }] = await Promise.all([
    supabase.from('profiles').select('id, name, role, is_admin, is_owner').order('updated_at', { ascending: false }),
    supabase.from('admin_permissions').select('*'),
  ])
  const emails = await emailMap(supabase)
  const profileMap = new Map((profiles ?? []).map((p: ProfileRow) => [p.id, p]))

  const partners = (perms ?? []).map((p: PermRow) => {
    const prof = profileMap.get(p.user_id)
    return {
      user_id: p.user_id,
      name: prof?.name ?? null,
      email: emails[p.user_id] ?? null,
      role: prof?.role ?? null,
      allowed_tabs: p.allowed_tabs ?? [],
      active: p.active,
      note: p.note,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }
  })

  // Candidates: everyone who isn't the owner and isn't already a partner.
  const partnerIds = new Set((perms ?? []).map((p: PermRow) => p.user_id))
  const candidates = (profiles ?? [])
    .filter((p: ProfileRow) => !p.is_owner && !p.is_admin && !partnerIds.has(p.id))
    .map((p: ProfileRow) => ({ id: p.id, name: p.name, email: emails[p.id] ?? null, role: p.role }))

  return NextResponse.json({ partners, candidates })
}

// POST — grant (or re-grant) a partner a set of sections.
export async function POST(req: Request) {
  const auth = await verifyOwner(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, userId } = auth

  const body = await req.json().catch(() => ({}))
  const targetId = body.userId as string | undefined
  if (!targetId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  // Never let a partner be granted to an owner row.
  const { data: target } = await supabase.from('profiles').select('is_owner, is_admin').eq('id', targetId).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.is_owner || target.is_admin) return NextResponse.json({ error: 'That user is already a full admin/owner' }, { status: 400 })

  const allowed = sanitizeTabs(body.allowed_tabs)
  const { data, error } = await supabase
    .from('admin_permissions')
    .upsert({
      user_id: targetId,
      allowed_tabs: allowed,
      active: true,
      note: body.note?.trim() || null,
      granted_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permission: data })
}

// PATCH — update a partner's sections or toggle active (user_id in body).
export async function PATCH(req: Request) {
  const auth = await verifyOwner(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const body = await req.json().catch(() => ({}))
  const targetId = body.userId as string | undefined
  if (!targetId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('allowed_tabs' in body) patch.allowed_tabs = sanitizeTabs(body.allowed_tabs)
  if ('active' in body) patch.active = !!body.active
  if ('note' in body) patch.note = body.note?.trim() || null

  const { data, error } = await supabase.from('admin_permissions').update(patch).eq('user_id', targetId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permission: data })
}

// DELETE — fully revoke a partner (user_id in body).
export async function DELETE(req: Request) {
  const auth = await verifyOwner(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  const body = await req.json().catch(() => ({}))
  const targetId = body.userId as string | undefined
  if (!targetId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const { error } = await supabase.from('admin_permissions').delete().eq('user_id', targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
