import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Trusted server-to-server caller (e.g. a future cron job sending nudges) that
// can't carry a user JWT. Only valid when CRON_SECRET is configured.
function isCronAuthed(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('x-cron-secret')
  return !!provided && provided === secret
}

export async function POST(request: Request) {
  try {
    // GATE: this endpoint can blast push to every subscriber, so it must never
    // be public. Allow an admin/owner (or a partner granted the "push" section),
    // or a trusted server caller holding the cron secret.
    if (!isCronAuthed(request)) {
      const auth = await verifyAdmin(request, 'push')
      if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
    }

    const { title, body, url = '/today', userId } = await request.json()
    if (!title || !body) return Response.json({ error: 'title and body required' }, { status: 400 })

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    const supabaseAdmin = getAdmin()
    let query = supabaseAdmin.from('push_subscriptions').select('*')
    if (userId) query = query.eq('user_id', userId)
    const { data: subs } = await query

    if (!subs?.length) return Response.json({ sent: 0, message: 'No subscribers' })

    const payload = JSON.stringify({ title, body, url })
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          if (err.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
          }
          throw err
        })
      )
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    return Response.json({ sent, failed, total: subs.length })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
