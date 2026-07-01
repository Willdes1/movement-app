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

    // Pending assignment (Chunk 5a) — a coach assigned a program that this athlete
    // hasn't activated yet. Surfaced so the app can prompt "Activate?".
    let pendingAssignment: { id: string; programName: string | null; coachName: string; startDate: string } | null = null
    {
      const { data: p } = await supabase
        .from('coach_program_assignments')
        .select('id, start_date, coach_id, coach_programs(name)')
        .eq('client_id', targetId).eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1).single()
      if (p) {
        const { data: pc } = await supabase.from('profiles').select('name').eq('id', p.coach_id).single()
        const pname = (p.coach_programs as unknown as { name: string }[] | null)?.[0]?.name
          ?? (p.coach_programs as unknown as { name: string } | null)?.name ?? null
        pendingAssignment = { id: p.id, programName: pname, coachName: pc?.name ?? 'your coach', startDate: p.start_date }
      }
    }

    // Get active assignment for this client.
    // NOTE: coach_programs has NO `description` column — selecting it here errored
    // the whole embed and silently nulled the assignment, which made `coached`
    // false for everyone (the bug that hid assigned programs). Keep this list to
    // columns that actually exist.
    const { data: assignment } = await supabase
      .from('coach_program_assignments')
      .select('id, program_id, coach_id, start_date, status, created_at, coach_programs(id, name, weeks_total, notes)')
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

      if (!ended) return Response.json({ assignment: null, pendingAssignment })

      const { data: endedCoach } = await supabase
        .from('profiles').select('name').eq('id', ended.coach_id).single()
      const endedProgramName =
        (ended.coach_programs as unknown as { name: string }[] | null)?.[0]?.name
        ?? (ended.coach_programs as unknown as { name: string } | null)?.name
        ?? null

      return Response.json({
        assignment: null,
        pendingAssignment,
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

    // Supabase embeds a to-one relation as a single OBJECT on .single() queries
    // (and as an array elsewhere) — handle BOTH so the program always resolves.
    // The ended-assignment + replace-warning paths already defend against both
    // shapes; this active path was the one spot that didn't, which silently nulled
    // the program and made `coached` false (program assigned but never showing).
    const programRaw = assignment.coach_programs as unknown
    const program = (Array.isArray(programRaw) ? programRaw[0] : programRaw) ?? null

    // The coach's personal library (their custom clips + cues). RLS keeps this
    // readable only by the coach, so we resolve it here (service role) and hand
    // the client a name-keyed map to enrich the exercises the coach programmed.
    const { data: coachLib } = await supabase
      .from('coach_exercise_library')
      .select('name, instructions, notes, how, breathing, core, tip, custom_fields, sets_reps, video_type, youtube_url, youtube_start_sec, youtube_end_sec, video_url')
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
      pendingAssignment,
    })
  } catch (err) {
    console.error('my-program error:', err)
    return Response.json({ error: 'Failed to load program' }, { status: 500 })
  }
}
