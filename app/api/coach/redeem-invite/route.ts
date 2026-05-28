import { createClient } from '@supabase/supabase-js'
import { createClient as createAnonClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const { code, userId } = await request.json()
    if (!code || !userId) return Response.json({ error: 'Missing code or userId' }, { status: 400 })

    const supabase = getServiceClient()

    // Look up the invite code
    const { data: invite, error: inviteErr } = await supabase
      .from('coach_invite_codes')
      .select('id, coach_id, uses, max_uses, active')
      .eq('code', code.toUpperCase().trim())
      .eq('active', true)
      .single()

    if (inviteErr || !invite) return Response.json({ error: 'Invalid or expired invite code' }, { status: 404 })
    if (invite.uses >= invite.max_uses) return Response.json({ error: 'This invite code has reached its limit' }, { status: 400 })

    // Prevent joining own roster
    if (invite.coach_id === userId) return Response.json({ error: 'You cannot join your own roster' }, { status: 400 })

    // Check if already in this coach's roster
    const { data: existing } = await supabase
      .from('coach_clients')
      .select('id, status')
      .eq('coach_id', invite.coach_id)
      .eq('client_id', userId)
      .single()

    if (existing?.status === 'active') return Response.json({ error: 'You are already in this coach\'s roster' }, { status: 400 })

    if (existing) {
      // Re-activate if previously inactive
      await supabase.from('coach_clients').update({ status: 'active' }).eq('id', existing.id)
    } else {
      // Create new coach_clients row
      const { error: insertErr } = await supabase.from('coach_clients').insert({
        coach_id: invite.coach_id,
        client_id: userId,
        status: 'active',
      })
      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })
    }

    // Increment uses
    await supabase.from('coach_invite_codes').update({ uses: invite.uses + 1 }).eq('id', invite.id)

    // Get coach name for the success message
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', invite.coach_id)
      .single()

    return Response.json({ success: true, coachName: coachProfile?.name ?? 'Your coach' })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
