import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { planFor, currentPeriod } from '@/lib/coach-plans'
import { getCoachUsage } from '@/lib/coach-usage'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// The coach's current plan + this month's usage, for the Billing page.
export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createClient(SUPA_URL, SERVICE_KEY)
  const { data: profile } = await svc.from('profiles').select('plan, stripe_customer_id').eq('id', user.id).single()

  const plan = planFor(profile?.plan)
  const usage = await getCoachUsage(svc, user.id)

  return NextResponse.json({
    planKey: plan.key,
    plan,
    usage,
    period: currentPeriod(),
    hasBillingAccount: !!profile?.stripe_customer_id,
    stripeReady: !!process.env.STRIPE_SECRET_KEY,
  })
}
