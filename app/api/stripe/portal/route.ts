import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { verifyUser } from '@/lib/admin-auth'

// The customer whose billing portal we open is derived from the VERIFIED JWT.
//
// This route used to take `userId` from the request body with no auth, look up
// that person's stripe_customer_id with the service-role key, and return a live
// Stripe billing portal URL for them. That portal exposes payment methods,
// invoices and billing address, and allows cancelling the subscription, so
// anyone holding a user id could open somebody else's billing page. It only
// ever 404'd because BILLING_LIVE is false and no profile has a customer id
// yet: it would have armed itself the moment billing went live.

export async function POST(req: NextRequest) {
  const auth = await verifyUser(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase: supabaseAdmin, userId } = auth

  const { returnUrl } = await req.json()

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id as string,
    return_url: returnUrl,
  })

  return NextResponse.json({ url: session.url })
}
