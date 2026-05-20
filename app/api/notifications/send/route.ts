import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { title, body, url = '/today', userId } = await request.json()
    if (!title || !body) return Response.json({ error: 'title and body required' }, { status: 400 })

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
          // 410 Gone = subscription expired, clean it up
          if (err.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
          }
          throw err
        })
      )
    )

    const sent    = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    return Response.json({ sent, failed, total: subs.length })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
