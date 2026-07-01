export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Push the athlete when their coach assigns them a program (pending activation).
export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await anon.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { clientId, programName } = await req.json() as { clientId: string; programName?: string }
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

    const supabase = createClient(SUPA_URL, SERVICE_KEY)

    // Only push if there's a real pending assignment from this coach to this client.
    const { data: pending } = await supabase
      .from('coach_program_assignments')
      .select('id')
      .eq('coach_id', user.id).eq('client_id', clientId).eq('status', 'pending')
      .limit(1)
    if (!pending?.length) return NextResponse.json({ pushed: 0 })

    const { data: coachProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    const coachFirst = coachProfile?.name?.split(' ')[0] ?? 'Your coach'

    let pushed = 0
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', clientId)
      if (subs?.length) {
        const payload = JSON.stringify({
          title: `Coach ${coachFirst} assigned you a program 🎯`,
          body: `${programName ? `"${programName}" ` : ''}is ready — open the app to activate it.`,
          url: '/today',
        })
        const results = await Promise.allSettled(
          subs.map(sub =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            ).catch(async err => {
              if (err.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
              throw err
            })
          )
        )
        pushed = results.filter(r => r.status === 'fulfilled').length
      }
    } catch { /* best-effort */ }

    return NextResponse.json({ pushed })
  } catch (err) {
    console.error('notify-assignment error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
