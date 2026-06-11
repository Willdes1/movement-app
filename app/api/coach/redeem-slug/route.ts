import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Connects the authenticated user to a coach via the coach's join slug.
// Mirrors redeem-invite, plus: claims a matching pending client by email.
export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug } = await request.json() as { slug: string }
    if (!slug) return Response.json({ error: 'Missing slug' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Resolve coach
    const { data: coach } = await supabase
      .from('profiles')
      .select('id, name, role, is_admin')
      .eq('coach_slug', slug.toLowerCase().trim())
      .single()

    if (!coach || (coach.role !== 'coach' && coach.is_admin !== true)) {
      return Response.json({ error: 'Invalid join link' }, { status: 404 })
    }
    if (coach.id === user.id) {
      return Response.json({ error: 'You cannot join your own roster' }, { status: 400 })
    }

    // Add to roster (re-activate if previously removed)
    const { data: existing } = await supabase
      .from('coach_clients')
      .select('id, status')
      .eq('coach_id', coach.id)
      .eq('client_id', user.id)
      .single()

    if (existing) {
      if (existing.status !== 'active') {
        await supabase.from('coach_clients').update({ status: 'active' }).eq('id', existing.id)
      }
    } else {
      const { error: insertErr } = await supabase.from('coach_clients').insert({
        coach_id: coach.id, client_id: user.id, status: 'active',
      })
      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })
    }

    // Claim a pending client record by email match (carries the coach's prep over)
    if (user.email) {
      await supabase
        .from('coach_pending_clients')
        .update({ status: 'claimed', claimed_by: user.id, claimed_at: new Date().toISOString() })
        .eq('coach_id', coach.id)
        .eq('status', 'pending')
        .eq('email', user.email.toLowerCase())
    }

    return Response.json({ success: true, coachName: coach.name ?? 'Your coach' })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
