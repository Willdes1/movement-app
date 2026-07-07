import { createClient } from '@supabase/supabase-js'
import { claudeCostUsd } from './ai-costs'
import { verifiedInsert, VerifyError } from './verified-write'

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

    // Read-after-write verified: a rejected/mismatched insert now logs [VERIFY_FAIL]
    // + a harness_events row and throws — exactly the failure that was silent before.
    await verifiedInsert(supabase, 'token_usage', {
      operation,
      api_route: route,
      input_tokens,
      output_tokens,
      estimated_cost_usd,
      metadata: { provider, ...(model ? { model } : {}) },
    }, {
      context: `logTokens:${operation}`,
      expect: ['operation', 'api_route', 'input_tokens', 'output_tokens'],
    })
  } catch (err) {
    // CONTAINMENT (deliberate): the verify helper already logged the failure
    // LOUD (console.error [VERIFY_FAIL] + harness_events). We swallow the throw
    // here ONLY so ancillary cost-logging can't 500 a user's plan/voice request.
    // The failure is visible in logs + the Telemetry tab — not silent.
    if (!(err instanceof VerifyError)) console.error('[TOKENS] logTokens failed:', err)
  }
}
