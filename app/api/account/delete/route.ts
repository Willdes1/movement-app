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

  // 4. COACH-OWNED rows. Everything above keys off the user as a CLIENT, so a
  //    deleted coach used to leave their whole practice behind: programs,
  //    roster, library, voice clone. The dangerous leftover is
  //    coach_invite_codes — an orphaned code stays redeemable, so a new athlete
  //    could join the roster of a coach who no longer exists.
  const { data: coachPrograms } = await supabase.from('coach_programs').select('id').eq('coach_id', userId)
  const coachProgramIds = (coachPrograms ?? []).map(p => p.id)
  if (coachProgramIds.length) {
    await supabase.from('coach_program_weeks').delete().in('program_id', coachProgramIds)
  }
  const coachDeletions = [
    'coach_program_assignments',
    'coach_programs',
    'coach_clients',
    'coach_client_notes',
    'coach_pending_clients',
    'coach_invite_codes',
    'coach_exercise_audio',
    'coach_exercise_library',
    'coach_voices',
    'coach_usage',
  ]
  for (const table of coachDeletions) {
    await supabase.from(table).delete().eq('coach_id', userId)
  }
  await supabase.from('coach_messages').delete().eq('coach_id', userId)

  // 5. Delete the profile (cascades anything FK'd to profiles(id)).
  await supabase.from('profiles').delete().eq('id', userId)

  // 6. Finally remove the auth user. This is the step that actually closes the
  //    account AND releases the email address, so the same person can sign up
  //    again from scratch. If it fails, surface the error so the client doesn't
  //    show success over a half-deleted account.
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
