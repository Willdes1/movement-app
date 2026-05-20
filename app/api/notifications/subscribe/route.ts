import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId, subscription, unsubscribe } = await request.json()
    if (!userId || !subscription?.endpoint) {
      return Response.json({ error: 'Missing userId or subscription' }, { status: 400 })
    }

    if (unsubscribe) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint)
      return Response.json({ ok: true })
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id:  userId,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
      }, { onConflict: 'user_id,endpoint' })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
