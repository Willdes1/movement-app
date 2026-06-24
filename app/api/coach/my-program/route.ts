import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Must match CoachedSessionCard's normalizeExName so movement names line up with
// the coach's library keys (strip any trailing sets/reps, then normalize).
function normKey(raw: string): string {
  return raw.toLowerCase()
    .replace(/\s+\d+[×x]\d+.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
    .replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

export async function GET(request: Request) {
  try {
    // Verify caller's identity via their JWT
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceClient()

    // Admins may request another user's assignment (Zoom In impersonation)
    let targetId = user.id
    const overrideId = new URL(request.url).searchParams.get('userId')
    if (overrideId && overrideId !== user.id) {
      const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (caller?.is_admin === true) targetId = overrideId
    }

    // Get active assignment for this client
    const { data: assignment } = await supabase
      .from('coach_program_assignments')
      .select('id, program_id, coach_id, start_date, status, created_at, coach_programs(id, name, weeks_total, notes, description)')
      .eq('client_id', targetId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!assignment) {
      // No active program — surface the most recent ended assignment so the
      // app can ask "are you still working with a coach?" (win-back flow)
      const { data: ended } = await supabase
        .from('coach_program_assignments')
        .select('id, status, start_date, created_at, coach_id, coach_programs(name)')
        .eq('client_id', targetId)
        .neq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!ended) return Response.json({ assignment: null })

      const { data: endedCoach } = await supabase
        .from('profiles').select('name').eq('id', ended.coach_id).single()
      const endedProgramName =
        (ended.coach_programs as unknown as { name: string }[] | null)?.[0]?.name
        ?? (ended.coach_programs as unknown as { name: string } | null)?.name
        ?? null

      return Response.json({
        assignment: null,
        endedAssignment: {
          id: ended.id,
          status: ended.status,
          programName: endedProgramName,
          coachName: endedCoach?.name ?? 'your coach',
        },
      })
    }

    // Get coach name
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', assignment.coach_id)
      .single()

    // Get all weeks for this program
    const { data: weeks } = await supabase
      .from('coach_program_weeks')
      .select('id, week_number, label, phase, days, coach_notes')
      .eq('program_id', assignment.program_id)
      .order('week_number', { ascending: true })

    const program = (assignment.coach_programs as Record<string, unknown>[] | null)?.[0] ?? null

    // The coach's personal library (their custom clips + cues). RLS keeps this
    // readable only by the coach, so we resolve it here (service role) and hand
    // the client a name-keyed map to enrich the exercises the coach programmed.
    const { data: coachLib } = await supabase
      .from('coach_exercise_library')
      .select('name, instructions, notes, sets_reps, video_type, youtube_url, youtube_start_sec, youtube_end_sec, video_url')
      .eq('coach_id', assignment.coach_id)
    const coachLibrary: Record<string, unknown> = {}
    for (const row of coachLib ?? []) {
      const k = normKey(row.name as string)
      if (k && !(k in coachLibrary)) coachLibrary[k] = row
    }

    // Does this coach have a ready cloned voice? (drives the 🔈 button on the client.)
    const { data: voice } = await supabase
      .from('coach_voices').select('status').eq('coach_id', assignment.coach_id).single()
    const coachVoiceReady = voice?.status === 'ready'

    return Response.json({
      assignment: {
        id: assignment.id,
        start_date: assignment.start_date,
        status: assignment.status,
      },
      program,
      weeks: weeks ?? [],
      coachName: coachProfile?.name ?? 'Your Coach',
      coachId:   assignment.coach_id,
      coachLibrary,
      coachVoiceReady,
    })
  } catch (err) {
    console.error('my-program error:', err)
    return Response.json({ error: 'Failed to load program' }, { status: 500 })
  }
}
