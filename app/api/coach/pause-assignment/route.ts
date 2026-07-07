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

// Chunk 5c — the athlete steps off their coach program back to their own plan.
// Pauses the active coach assignment (stamping the week reached so it resumes
// later) → coached goes false → the athlete's AI plan resurfaces. Self-only.
export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await anon.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(SUPA_URL, SERVICE_KEY)

    const { data: active } = await supabase
      .from('coach_program_assignments')
      .select('id, start_date, coach_programs(weeks_total)')
      .eq('client_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).single()
    if (!active) return NextResponse.json({ success: true, paused: false })

    const cp = active.coach_programs as unknown as { weeks_total?: number }[] | { weeks_total?: number } | null
    const weeksTotal = (Array.isArray(cp) ? cp[0]?.weeks_total : cp?.weeks_total) ?? 1

    await verifiedUpdate(supabase, 'coach_program_assignments', active.id,
      { status: 'paused', resume_week: programWeek(active.start_date, weeksTotal) },
      { context: 'assignment-pause', expect: ['status'], effectiveUserId: user.id })

    return NextResponse.json({ success: true, paused: true })
  } catch (err) {
    console.error('pause-assignment error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
