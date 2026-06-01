import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Day = { movements?: string[]; type?: string }
type Week = { days: Day[] }

function normalizeExerciseName(raw: string): string {
  return raw
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function toDisplayName(raw: string): string {
  return raw
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  // Verify admin
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { programId } = await req.json() as { programId: string }

  // Fetch all weeks for this program
  const { data: weekRows } = await supabase
    .from('coach_program_weeks')
    .select('days')
    .eq('program_id', programId)

  if (!weekRows?.length) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  // Extract all unique exercise names
  const allMovements = new Set<string>()
  weekRows.forEach(w => {
    const week = w as unknown as Week
    ;(week.days ?? []).forEach(day => {
      if (day.type === 'rest') return
      ;(day.movements ?? []).forEach(m => {
        const name = m.trim()
        if (name && name !== 'Full rest' && name !== 'Rest') allMovements.add(name)
      })
    })
  })

  const exercises = Array.from(allMovements).map(m => ({
    raw: m,
    name_normalized: normalizeExerciseName(m),
    name_display: toDisplayName(m),
  })).filter(e => e.name_normalized.length > 2)

  if (!exercises.length) return NextResponse.json({ seeded: 0, total: 0 })

  // Check which are already in exercise_library
  const { data: existing } = await supabase
    .from('exercise_library')
    .select('name_normalized')
    .in('name_normalized', exercises.map(e => e.name_normalized))

  const existingKeys = new Set((existing ?? []).map(e => e.name_normalized))
  const toInsert = exercises.filter(e => !existingKeys.has(e.name_normalized))

  // Batch upsert new exercises
  const BATCH = 50
  let seeded = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from('exercise_library').insert(
      chunk.map(e => ({
        name_normalized: e.name_normalized,
        name_display: e.name_display,
      }))
    )
    if (!error) seeded += chunk.length
  }

  return NextResponse.json({ seeded, total: exercises.length, alreadyExisted: existingKeys.size })
}
