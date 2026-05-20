import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const PRICE_IDS: Record<string, string> = {
  pro:     process.env.STRIPE_PRO_PRICE_ID!,
  plus:    process.env.STRIPE_PLUS_PRICE_ID!,
  supreme: process.env.STRIPE_SUPREME_PRICE_ID!,
}

export const PLAN_FROM_PRICE: Record<string, 'pro' | 'plus' | 'supreme'> = {
  [process.env.STRIPE_PRO_PRICE_ID!]:     'pro',
  [process.env.STRIPE_PLUS_PRICE_ID!]:    'plus',
  [process.env.STRIPE_SUPREME_PRICE_ID!]: 'supreme',
}
