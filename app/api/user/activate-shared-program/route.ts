import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { coachProgramId } = await req.json() as { coachProgramId: string }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  // Get user's role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const userRole = profile?.role ?? 'free'

  // Verify the program is shared with this role
  const { data: coachProg } = await supabase
    .from('coach_programs')
    .select('id, name, weeks_total, shared_with_roles')
    .eq('id', coachProgramId)
    .single()

  if (!coachProg) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
  if (!coachProg.shared_with_roles?.includes(userRole)) {
    return NextResponse.json({ error: 'Not available for your account type' }, { status: 403 })
  }

  // Check if user already has this program activated
  const { data: existing } = await supabase
    .from('user_imported_programs')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('source_coach_program_id', coachProgramId)
    .single()

  if (existing) {
    // Re-activate it
    await supabase.from('user_imported_programs').update({ status: 'active' }).eq('id', existing.id)
    await supabase.from('profiles').update({ active_imported_program_id: existing.id, imported_program_current_week: 1 }).eq('id', user.id)
    return NextResponse.json({ programId: existing.id, reactivated: true })
  }

  // Fetch coach program weeks
  const { data: weekRows } = await supabase
    .from('coach_program_weeks')
    .select('week_number, label, phase, days, coach_notes')
    .eq('program_id', coachProgramId)
    .order('week_number', { ascending: true })

  if (!weekRows?.length) return NextResponse.json({ error: 'No weeks found' }, { status: 400 })

  // Create user_imported_programs record
  const { data: newProg, error: insertErr } = await supabase
    .from('user_imported_programs')
    .insert({
      user_id: user.id,
      name: coachProg.name,
      source: 'platform',
      source_coach_program_id: coachProgramId,
      weeks: [],
      status: 'active',
      current_week: 1,
    })
    .select('id')
    .single()

  if (insertErr || !newProg) return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })

  // Copy weeks into user_imported_program_weeks
  const weekInserts = weekRows.map(w => ({
    program_id: newProg.id,
    week_number: w.week_number,
    label: w.label ?? `Week ${w.week_number}`,
    phase: w.phase ?? null,
    days: w.days ?? [],
  }))

  await supabase.from('user_imported_program_weeks').insert(weekInserts)

  // Set as active imported program on profile
  await supabase.from('profiles')
    .update({ active_imported_program_id: newProg.id, imported_program_current_week: 1 })
    .eq('id', user.id)

  return NextResponse.json({ programId: newProg.id, reactivated: false })
}
