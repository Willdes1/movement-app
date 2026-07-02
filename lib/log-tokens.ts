import { createClient } from '@supabase/supabase-js'
import { claudeCostUsd } from './ai-costs'

// Server-only AI-cost logger. Writes to the `token_usage` table that the admin
// Spend Tracker + Health Monitor read from.
//
// IMPORTANT: `token_usage` is locked down by RLS — the anon role can't see or
// insert rows. This helper therefore uses the SERVICE ROLE key (it only ever
// runs inside API routes) so the insert always lands, and writes the real
// column name `api_route` (an earlier version wrote `route`, which doesn't
// exist — every call 400'd and was silently swallowed).
//
// Cost model: pass an exact `cost_usd` for non-Claude providers (OpenAI bills
// per character / per token / per minute — see lib/ai-costs.ts). If omitted,
// cost is computed from input/output tokens at Claude rates. Either way the
// dollar amount lands in `estimated_cost_usd`, which is what the Spend Tracker
// sums — so mixed providers roll up accurately.

export async function logTokens({
  operation,
  route,
  input_tokens = 0,
  output_tokens = 0,
  user_id,
  cost_usd,
  provider = 'anthropic',
  model,
}: {
  operation: string
  route: string
  input_tokens?: number
  output_tokens?: number
  user_id?: string | null
  cost_usd?: number
  provider?: string
  model?: string
}) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) { console.warn('logTokens: missing Supabase env'); return }

    const supabase = createClient(url, serviceKey)
    const estimated_cost_usd = cost_usd != null ? cost_usd : claudeCostUsd(input_tokens, output_tokens)

    // user_id is intentionally omitted — its column may not exist yet, and a
    // missing column would 400 the whole insert. Re-add once the user_id
    // migration (to-do/user-token-usage-tracking.md) is run.
    void user_id

    const { error } = await supabase.from('token_usage').insert({
      operation,
      api_route: route,
      input_tokens,
      output_tokens,
      estimated_cost_usd,
      metadata: { provider, ...(model ? { model } : {}) },
    })
    if (error) console.warn('logTokens insert failed:', error.message)
  } catch (err) {
    // Never let cost-logging break the actual request.
    console.warn('logTokens threw:', err)
  }
}
