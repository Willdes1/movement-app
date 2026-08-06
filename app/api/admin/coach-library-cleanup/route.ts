import { verifyAdmin } from '@/lib/admin-auth'
import { proposeName } from '@/lib/exercise-naming'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 6: the same name cleanup, for coach libraries.
//
//  The athlete library and each coach's library are separate tables holding
//  separate copies. Cleaning exercise_library never reached coach rows, so a
//  coach who imported a program before the cleanup still sees "Alt. DB Curls"
//  and "1-Arm Cross Cable Laterals" today.
//
//  Two sources for a better name, in order:
//    1. The global library's own name_display, when the row's stored key
//       matches. Always preferred, because then the coach sees exactly what an
//       athlete sees for the same movement.
//    2. Otherwise the shared naming rules, same as the athlete cleanup.
//
//  Only the display name changes. name_normalized is the join key back to the
//  global library and to program movements, so it is deliberately left alone.
// ─────────────────────────────────────────────────────────────────────────────

type CoachRow = {
  id: string
  coach_id: string
  name: string
  name_normalized: string | null
  video_url: string | null
  youtube_url: string | null
}

const PAGE = 1000

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const rows: CoachRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await auth.supabase
      .from('coach_exercise_library')
      .select('id, coach_id, name, name_normalized, video_url, youtube_url')
      .order('name')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data?.length) break
    rows.push(...(data as CoachRow[]))
    if (data.length < PAGE) break
  }

  const keys = [...new Set(rows.map(r => r.name_normalized).filter(Boolean))] as string[]
  const globalByKey = new Map<string, string>()
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await auth.supabase
      .from('exercise_library')
      .select('name_normalized, name_display')
      .in('name_normalized', keys.slice(i, i + 200))
    for (const g of (data ?? []) as { name_normalized: string; name_display: string }[]) {
      globalByKey.set(g.name_normalized, g.name_display)
    }
  }

  const proposals = rows.flatMap(r => {
    const fromGlobal = r.name_normalized ? globalByKey.get(r.name_normalized) : undefined
    const proposed = fromGlobal ?? proposeName(r.name).proposed
    if (!proposed || proposed === r.name) return []
    return [{
      id: r.id,
      coachId: r.coach_id,
      current: r.name,
      proposed,
      source: fromGlobal ? 'library' as const : 'rules' as const,
      hasVideo: !!(r.video_url || r.youtube_url),
    }]
  })

  return Response.json({
    coach_rows_total: rows.length,
    coaches: new Set(rows.map(r => r.coach_id)).size,
    proposed: proposals.length,
    from_library: proposals.filter(p => p.source === 'library').length,
    from_rules: proposals.filter(p => p.source === 'rules').length,
    proposals,
  })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const approvals: { id: string; proposed: string }[] =
    Array.isArray(body.approvals) ? body.approvals.slice(0, 500) : []
  if (!approvals.length) return Response.json({ error: 'No approvals supplied' }, { status: 400 })

  const renamed: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const a of approvals) {
    if (!a.proposed?.trim()) { failed.push({ id: a.id, error: 'empty name' }); continue }
    // Name only. Touching name_normalized would cut the row's link to the
    // global library and to the program movements that resolve through it.
    const { error } = await auth.supabase
      .from('coach_exercise_library')
      .update({ name: a.proposed.trim() })
      .eq('id', a.id)
    if (error) failed.push({ id: a.id, error: error.message })
    else renamed.push(a.proposed.trim())
  }

  return Response.json({ renamed: renamed.length, failed })
}
