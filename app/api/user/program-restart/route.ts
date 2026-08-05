import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resumeWeek, startDateForResume, TOTAL_WEEKS, localDateKey, parseDateKey } from '@/lib/program-progress'

export const runtime = 'nodejs'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Move an athlete back onto their existing program after a gap, without paying
// to rebuild a plan they already own.
//
// Both modes are a single change to start_date. Completions are stored as
// (week, day) and every real date on the calendar is derived from start_date,
// so shifting that one field moves the athlete through time and nothing else
// has to be rewritten. Same approach the coach side already uses to resume an
// assignment.
//
//   resume - put the first unfinished week on today. Keeps completions.
//   fresh  - put week 1 on today and clear completions. Keeps the plan itself.
//
// Neither mode calls Claude and neither deletes a weekly plan. Generating a new
// block is a different action and lives on the plan page.
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mode, today } = await req.json().catch(() => ({})) as { mode?: 'resume' | 'fresh'; today?: string }
  if (mode !== 'resume' && mode !== 'fresh') {
    return NextResponse.json({ error: 'mode must be resume or fresh' }, { status: 400 })
  }

  // The athlete's own date, because this server runs in UTC. Without it an
  // evening resume in the Americas would set a start date of tomorrow.
  const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(today ?? '') ? today! : localDateKey()
  const nowLocal = parseDateKey(todayKey)

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  // Scoped to the caller's own id, never a client-supplied program id.
  const { data: prog } = await supabase
    .from('training_programs')
    .select('id, start_date, total_weeks')
    .eq('user_id', user.id)
    .single()

  if (!prog) return NextResponse.json({ error: 'No program' }, { status: 404 })

  const totalWeeks = (prog.total_weeks as number) || TOTAL_WEEKS

  if (mode === 'fresh') {
    await supabase.from('day_completions').delete().eq('program_id', prog.id).eq('user_id', user.id)
    const startDate = todayKey
    const { error } = await supabase
      .from('training_programs')
      .update({ start_date: startDate, status: 'active' })
      .eq('id', prog.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ mode, startDate, week: 1 })
  }

  const { data: completions } = await supabase
    .from('day_completions')
    .select('week_number, day_index')
    .eq('program_id', prog.id)
    .eq('user_id', user.id)

  const week = resumeWeek(completions ?? [], totalWeeks)
  if (week === null) {
    // Every week is finished, so there is nothing to come back to.
    return NextResponse.json({ error: 'Program already complete', complete: true }, { status: 409 })
  }

  const startDate = startDateForResume(week, nowLocal)
  const { error } = await supabase
    .from('training_programs')
    .update({ start_date: startDate, status: 'active' })
    .eq('id', prog.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ mode, startDate, week })
}
