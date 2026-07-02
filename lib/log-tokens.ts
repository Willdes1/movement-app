import { createClient } from '@supabase/supabase-js'

// Server-only token-cost logger. Writes to the `token_usage` table that the
// admin Spend Tracker + Health Monitor read from.
//
// IMPORTANT: `token_usage` is locked down by RLS — the anon role can't see or
// insert rows. This helper therefore uses the SERVICE ROLE key (it only ever
// runs inside API routes) so the insert always lands, and writes the real
// column name `api_route` (an earlier version wrote `route`, which doesn't
// exist — every call 400'd and was silently swallowed, so nothing but the
// client-side `exercise_backfill` insert ever showed up).

const INPUT_RATE  = 3 / 1_000_000   // $3 / 1M input tokens  (Spend Tracker uses the same)
const OUTPUT_RATE = 15 / 1_000_000  // $15 / 1M output tokens

export async function logTokens({
  operation,
  route,
  input_tokens,
  output_tokens,
  user_id,
}: {
  operation: string
  route: string
  input_tokens: number
  output_tokens: number
  user_id?: string | null
}) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) { console.warn('logTokens: missing Supabase env'); return }

    const supabase = createClient(url, serviceKey)
    const estimated_cost_usd = (input_tokens ?? 0) * INPUT_RATE + (output_tokens ?? 0) * OUTPUT_RATE

    // Only known-good columns (matches the working client-side insert shape).
    // user_id is intentionally omitted — its column may not exist yet, and
    // including a missing column would 400 the whole insert. Re-add it here
    // once the user_id migration (to-do/user-token-usage-tracking.md) is run.
    void user_id

    const { error } = await supabase.from('token_usage').insert({
      operation,
      api_route: route,
      input_tokens,
      output_tokens,
      estimated_cost_usd,
    })
    if (error) console.warn('logTokens insert failed:', error.message)
  } catch (err) {
    // Never let cost-logging break the actual request.
    console.warn('logTokens threw:', err)
  }
}
