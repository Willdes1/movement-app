import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_IDS } from '@/lib/stripe'
import { verifyUser } from '@/lib/admin-auth'

// The user id and email come from the VERIFIED JWT, never from the body.
//
// This route used to take `userId` and `userEmail` straight out of the request
// with no auth at all, so any caller could create a Stripe customer bound to
// somebody else's profile and write `stripe_customer_id` onto their row. Both
// fields are now derived from the session and the body copies are ignored.

export async function POST(req: NextRequest) {
  const auth = await verifyUser(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase: supabaseAdmin, userId, email } = auth

  const { plan, returnUrl } = await req.json()

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // `profiles` has no email column; the address comes from the verified auth
  // record, which is also the only copy we can trust.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { supabase_user_id: userId },
    })
    customerId = customer.id
    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId)
    // Checked: an unrecorded customer id means the next checkout creates a
    // SECOND Stripe customer for the same person and their subscription history
    // splits across two records.
    if (updErr) {
      console.error('[STRIPE] failed to record stripe_customer_id for', userId, updErr)
      return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${returnUrl}?billing=success`,
    cancel_url: `${returnUrl}?billing=cancelled`,
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
  })

  return NextResponse.json({ url: session.url })
}
