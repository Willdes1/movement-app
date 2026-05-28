import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  try {
    // Verify caller identity via JWT
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

    // Get all active clients for this coach
    const { data: roster } = await supabase
      .from('coach_clients')
      .select('client_id')
      .eq('coach_id', user.id)
      .eq('status', 'active')

    if (!roster?.length) return Response.json({ clients: [], summary: { total: 0, avgWorkouts30d: 0, inactive: 0 } })

    const clientIds = roster.map(r => r.client_id)

    // Fetch profiles, active assignments, and workout logs in parallel
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()

    const [profilesRes, assignmentsRes, logsRes] = await Promise.all([
      supabase.from('profiles')
        .select('id, name, training_level')
        .in('id', clientIds),

      supabase.from('coach_program_assignments')
        .select('client_id, program_id, start_date, coach_programs(name, weeks_total)')
        .eq('coach_id', user.id)
        .eq('status', 'active')
        .in('client_id', clientIds),

      supabase.from('workout_logs')
        .select('user_id, logged_at')
        .in('user_id', clientIds)
        .gte('logged_at', since30d)
        .order('logged_at', { ascending: false }),
    ])

    const profiles    = profilesRes.data ?? []
    const assignments = assignmentsRes.data ?? []
    const logs        = logsRes.data ?? []

    // Group logs by user_id — count distinct calendar dates for session count
    const logsByUser = new Map<string, { dates30d: Set<string>; dates7d: Set<string>; lastLogged: string | null }>()
    for (const log of logs as { user_id: string; logged_at: string }[]) {
      if (!logsByUser.has(log.user_id)) {
        logsByUser.set(log.user_id, { dates30d: new Set(), dates7d: new Set(), lastLogged: null })
      }
      const entry = logsByUser.get(log.user_id)!
      const dateStr = log.logged_at.slice(0, 10)
      entry.dates30d.add(dateStr)
      if (log.logged_at >= since7d) entry.dates7d.add(dateStr)
      if (!entry.lastLogged) entry.lastLogged = log.logged_at
    }

    const assignmentByClient = new Map(
      (assignments as any[]).map(a => [a.client_id, a])
    )
    const profileByClient = new Map(
      (profiles as any[]).map(p => [p.id, p])
    )

    function currentWeek(startDate: string, total: number): number {
      const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
      return Math.min(Math.max(Math.floor(days / 7) + 1, 1), total)
    }

    const clients = clientIds.map(id => {
      const profile    = profileByClient.get(id)
      const assignment = assignmentByClient.get(id)
      const logData    = logsByUser.get(id)
      const program    = (assignment?.coach_programs as { name: string; weeks_total: number }[])?.[0]
      const weeksTotal = program?.weeks_total ?? null
      const startDate  = assignment?.start_date ?? null

      return {
        id,
        name:           profile?.name ?? 'Unknown',
        training_level: profile?.training_level ?? null,
        program_name:   program?.name ?? null,
        current_week:   startDate && weeksTotal ? currentWeek(startDate, weeksTotal) : null,
        weeks_total:    weeksTotal,
        start_date:     startDate,
        workouts_7d:    logData?.dates7d.size ?? 0,
        workouts_30d:   logData?.dates30d.size ?? 0,
        last_workout:   logData?.lastLogged ?? null,
      }
    })

    // Sort by most recently active
    clients.sort((a, b) => {
      if (!a.last_workout && !b.last_workout) return 0
      if (!a.last_workout) return 1
      if (!b.last_workout) return -1
      return b.last_workout.localeCompare(a.last_workout)
    })

    const inactive = clients.filter(c => c.workouts_7d === 0).length
    const total30d  = clients.reduce((sum, c) => sum + c.workouts_30d, 0)

    return Response.json({
      clients,
      summary: {
        total:         clients.length,
        avgWorkouts30d: clients.length > 0 ? Math.round(total30d / clients.length) : 0,
        inactive,
      },
    })
  } catch (err) {
    console.error('analytics error:', err)
    return Response.json({ error: 'Failed' }, { status: 500 })
  }
}
