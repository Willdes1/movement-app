export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// The athlete activates a pending coach assignment. Retires their current active
// coach program (kept as 'replaced' — logs + completions preserved), then flips
// the pending one to 'active' starting today. Self-only (derived from the JWT).
export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await anon.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignmentId } = await req.json() as { assignmentId: string }
    if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

    const supabase = createClient(SUPA_URL, SERVICE_KEY)

    // Verify the pending assignment belongs to this athlete.
    const { data: pending } = await supabase
      .from('coach_program_assignments')
      .select('id, client_id, status')
      .eq('id', assignmentId).single()
    if (!pending || pending.client_id !== user.id || pending.status !== 'pending') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Retire any currently-active coach program for this athlete (progress kept).
    await supabase.from('coach_program_assignments')
      .update({ status: 'replaced' })
      .eq('client_id', user.id).eq('status', 'active')

    // Activate — starts today.
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('coach_program_assignments')
      .update({ status: 'active', start_date: today })
      .eq('id', assignmentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('activate-assignment error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
