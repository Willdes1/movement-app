// ─────────────────────────────────────────────────────────────────────────────
// COACH PRICING — single source of truth. Edit any number here and the whole
// coach-billing UI + gating updates. Prices are DISPLAY ONLY — Stripe is the
// real source of truth for what a card is charged (create matching products in
// Stripe and set the price IDs in Vercel: STRIPE_PRO/PLUS/SUPREME_PRICE_ID).
//
// Model: monthly AI-program credits (hard cap → upgrade prompt when out; auto
// overages are Phase 2). Voice features (dictation + cloning) are paid-tier only.
// Messaging is included on every tier but capped by tier.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanKey = 'free' | 'pro' | 'plus' | 'supreme'

export type CoachPlan = {
  key: PlanKey
  name: string
  priceMonthly: number              // display only
  aiCredits: number                 // AI-program credits per month (free = one-time trial allowance)
  messagesPerMonth: number | null   // null = unlimited
  voice: boolean                    // voice dictation + voice cloning unlocked
  blurb: string
  /** Maps to the Stripe price slot in lib/stripe.ts PRICE_IDS. Undefined = not purchasable (free). */
  stripePlan?: 'pro' | 'plus' | 'supreme'
}

export const COACH_PLANS: CoachPlan[] = [
  { key: 'free',    name: 'Free',    priceMonthly: 0,  aiCredits: 5,   messagesPerMonth: 100,  voice: false, blurb: 'Try the coach portal — 5 AI programs to start.' },
  { key: 'pro',     name: 'Starter', priceMonthly: 19, aiCredits: 25,  messagesPerMonth: 1000, voice: true,  blurb: 'For coaches building a roster.', stripePlan: 'pro' },
  { key: 'plus',    name: 'Growth',  priceMonthly: 49, aiCredits: 75,  messagesPerMonth: 5000, voice: true,  blurb: 'More AI programs + messaging headroom.', stripePlan: 'plus' },
  { key: 'supreme', name: 'Pro',     priceMonthly: 99, aiCredits: 200, messagesPerMonth: null, voice: true,  blurb: 'High volume — unlimited messaging.', stripePlan: 'supreme' },
]

export function planFor(plan?: string | null): CoachPlan {
  return COACH_PLANS.find(p => p.key === plan) ?? COACH_PLANS[0]
}

/** Current billing period key, e.g. "2026-07". Credits reset when this rolls over. */
export function currentPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
