export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifiedUpdate } from '@/lib/verified-write'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function programWeek(startDate: string, weeksTotal: number): number {
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), Math.max(weeksTotal || 1, 1))
}
function weeksTotalOf(row: { coach_programs?: unknown }): number {
  const cp = row.coach_programs as unknown as { weeks_total?: number }[] | { weeks_total?: number } | null
  if (Array.isArray(cp)) return cp[0]?.weeks_total ?? 1
  return cp?.weeks_total ?? 1
}
const today = () => new Date().toISOString().slice(0, 10)

// Athlete activates / switches / restarts a coach program.
//   mode 'resume' → pick up at the week they'd reached (date-shift)
//   mode 'fresh'  → start at Day 1 (clears that program's day-completions; logs kept)
// Switching away from the current active program stamps its resume_week so it can
// be resumed later. Self-only (derived from the JWT).
export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await anon.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignmentId, mode = 'fresh' } = await req.json() as { assignmentId: string; mode?: 'resume' | 'fresh' }
    if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

    const supabase = createClient(SUPA_URL, SERVICE_KEY)

    const { data: target } = await supabase
      .from('coach_program_assignments')
      .select('id, client_id, status, start_date, resume_week, coach_programs(weeks_total)')
      .eq('id', assignmentId).single()
    if (!target || target.client_id !== user.id || target.status === 'cancelled') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: active } = await supabase
      .from('coach_program_assignments')
      .select('id, start_date, coach_programs(weeks_total)')
      .eq('client_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).single()

    // Restart the program that's already active (start_date → today, clear completions).
    if (active && active.id === target.id) {
      if (mode === 'fresh') {
        await supabase.from('coach_day_completions').delete().eq('assignment_id', target.id).eq('user_id', user.id)
        await verifiedUpdate(supabase, 'coach_program_assignments', target.id,
          { start_date: today(), resume_week: null },
          { context: 'assignment-restart', expect: ['start_date', 'resume_week'], effectiveUserId: user.id })
      }
      return NextResponse.json({ success: true, restarted: mode === 'fresh' })
    }

    // Switching away — stamp resume_week on the outgoing active program, retire it.
    if (active) {
      await verifiedUpdate(supabase, 'coach_program_assignments', active.id,
        { status: 'replaced', resume_week: programWeek(active.start_date, weeksTotalOf(active)) },
        { context: 'assignment-replace', expect: ['status'], effectiveUserId: user.id })
    }

    // Activate the target.
    let startDate = today()
    if (mode === 'resume' && target.resume_week && target.resume_week > 1) {
      startDate = new Date(Date.now() - (target.resume_week - 1) * 7 * 86_400_000).toISOString().slice(0, 10)
    } else if (mode === 'fresh') {
      await supabase.from('coach_day_completions').delete().eq('assignment_id', target.id).eq('user_id', user.id)
    }
    await verifiedUpdate(supabase, 'coach_program_assignments', target.id,
      { status: 'active', start_date: startDate, resume_week: null },
      { context: 'assignment-activate', expect: ['status', 'start_date'], effectiveUserId: user.id })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('activate-assignment error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
