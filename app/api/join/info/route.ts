import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Public: resolves a coach join slug to a display name for the landing page.
// Returns only the coach's name — nothing sensitive.
export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug')?.toLowerCase().trim()
    if (!slug) return Response.json({ valid: false }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: coach } = await supabase
      .from('profiles')
      .select('name, role, is_admin')
      .eq('coach_slug', slug)
      .single()

    if (!coach || (coach.role !== 'coach' && coach.is_admin !== true)) {
      return Response.json({ valid: false }, { status: 404 })
    }

    return Response.json({ valid: true, coachName: coach.name ?? 'Your Coach' })
  } catch {
    return Response.json({ valid: false }, { status: 500 })
  }
}
