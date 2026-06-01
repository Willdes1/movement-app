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

  // Extract all unique exercise names from every day
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

  if (!exercises.length) return NextResponse.json({ seeded: 0, total: 0, queued: 0 })

  // Fetch what's already in exercise_library (id + name_normalized + video_url)
  const { data: existing } = await supabase
    .from('exercise_library')
    .select('id, name_normalized, video_url')
    .in('name_normalized', exercises.map(e => e.name_normalized))

  const existingMap = new Map((existing ?? []).map(e => [e.name_normalized, e]))
  const toInsert = exercises.filter(e => !existingMap.has(e.name_normalized))

  // Step 1: Insert any exercises not yet in the library
  const BATCH = 50
  let seeded = 0
  const newlyInserted: { name_normalized: string }[] = []
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const { data: inserted, error } = await supabase
      .from('exercise_library')
      .insert(chunk.map(e => ({ name_normalized: e.name_normalized, name_display: e.name_display })))
      .select('id, name_normalized, video_url')
    if (!error && inserted) {
      seeded += inserted.length
      inserted.forEach(e => existingMap.set(e.name_normalized, e))
      newlyInserted.push(...inserted)
    }
  }

  // Step 2: Queue ALL program exercises (new + existing without video) for priority curation
  // These become status='queued' in exercise_video_candidates, which puts them at the TOP
  // of the curation pipeline — ahead of the alphabetical backlog.
  const toQueue = exercises.filter(e => {
    const lib = existingMap.get(e.name_normalized)
    return lib && !lib.video_url // in library but no video yet
  })

  // Don't re-queue exercises that already have proposed/approved candidates
  let queued = 0
  if (toQueue.length > 0) {
    const libIds = toQueue.map(e => existingMap.get(e.name_normalized)!.id).filter(Boolean)
    const { data: alreadyProposed } = await supabase
      .from('exercise_video_candidates')
      .select('exercise_id')
      .in('exercise_id', libIds)
      .in('status', ['proposed', 'approved', 'queued'])
    const alreadyQueuedIds = new Set((alreadyProposed ?? []).map(r => r.exercise_id))

    const queueInserts = libIds
      .filter(id => !alreadyQueuedIds.has(id))
      .map(exercise_id => ({ exercise_id, status: 'queued' }))

    if (queueInserts.length > 0) {
      const { error: qErr } = await supabase
        .from('exercise_video_candidates')
        .insert(queueInserts)
      if (!qErr) queued = queueInserts.length
    }
  }

  return NextResponse.json({
    seeded,               // new exercises added to exercise_library
    queued,               // exercises added to priority video curation queue
    total: exercises.length,
    alreadyExisted: existingMap.size - seeded,
  })
}
