import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, PLAN_FROM_PRICE } from '@/lib/stripe'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabaseAdmin = getAdmin()
  const sub = event.data.object as Stripe.Subscription

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const priceId = sub.items.data[0]?.price.id
      const plan = PLAN_FROM_PRICE[priceId] ?? 'free'
      const active = sub.status === 'active' || sub.status === 'trialing'
      const userId = sub.metadata?.supabase_user_id

      if (userId) {
        await supabaseAdmin
          .from('profiles')
          .update({ plan: active ? plan : 'free' })
          .eq('id', userId)
      } else {
        await supabaseAdmin
          .from('profiles')
          .update({ plan: active ? plan : 'free' })
          .eq('stripe_customer_id', sub.customer as string)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', userId)
      } else {
        await supabaseAdmin
          .from('profiles')
          .update({ plan: 'free' })
          .eq('stripe_customer_id', sub.customer as string)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
