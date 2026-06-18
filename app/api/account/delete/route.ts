import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// A user permanently deletes THEIR OWN account. The id is always derived from
// the verified JWT — never from the request body — so one user can't delete
// another. Best-effort wipe of their data, then removal of the auth user.
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const body = await req.json().catch(() => ({}))

  // 1. Capture anonymous churn feedback before anything is destroyed.
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).single()
  await supabase.from('account_deletion_feedback').insert({
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 80) : null,
    detail: typeof body.detail === 'string' ? body.detail.slice(0, 1000) : null,
    role: prof?.role ?? null,
  })

  // 2. Delete program-scoped rows first (weekly_plans keys off program_id).
  const { data: programs } = await supabase.from('training_programs').select('id').eq('user_id', userId)
  const programIds = (programs ?? []).map(p => p.id)
  if (programIds.length) {
    await supabase.from('weekly_plans').delete().in('program_id', programIds)
  }

  // 3. Best-effort wipe of the user's data across the app. Errors are ignored
  //    per-table (a table may not exist on every environment) — the auth delete
  //    below is the backstop, and most tables also cascade from profiles.
  const deletions: [string, string][] = [
    ['training_programs', 'user_id'],
    ['day_completions', 'user_id'],
    ['workout_logs', 'user_id'],
    ['exercise_set_logs', 'user_id'],
    ['for_you_feed', 'user_id'],
    ['user_imported_programs', 'user_id'],
    ['plan_conversion_requests', 'user_id'],
    ['coach_day_completions', 'user_id'],
    ['bug_reports', 'user_id'],
    ['token_usage', 'user_id'],
    ['coach_clients', 'client_id'],
    ['coach_program_assignments', 'client_id'],
    ['coach_client_notes', 'client_id'],
    ['coach_pending_clients', 'client_id'],
    ['admin_permissions', 'user_id'],
  ]
  for (const [table, col] of deletions) {
    await supabase.from(table).delete().eq(col, userId)
  }
  await supabase.from('coach_messages').delete().eq('client_id', userId)
  await supabase.from('coach_messages').delete().eq('sender_id', userId)

  // 4. Delete the profile (cascades anything FK'd to profiles(id)).
  await supabase.from('profiles').delete().eq('id', userId)

  // 5. Finally remove the auth user. This is the step that actually closes the
  //    account; if it fails, surface the error so the client doesn't show success.
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
