import { createClient } from '@supabase/supabase-js'

// Internal harness telemetry writer. Records when the system's own safety checks
// fire — read by the Admin → Telemetry tab so silent failures become visible.
//
// The `harness_events` table is created in Stage 2. Until then the DB insert
// simply no-ops on "table does not exist" — the caller's console.error is still
// the loud signal. This writer NEVER throws: telemetry must not break a request.

export type HarnessEventType = 'verify_fail' | 'route_error' | 'smoke_fail' | 'migration_drift'
export type HarnessSeverity = 'info' | 'warn' | 'error' | 'critical'

export async function logHarnessEvent(ev: {
  event_type: HarnessEventType
  message: string
  severity?: HarnessSeverity
  context?: string | null
  metadata?: Record<string, unknown>
  effective_user_id?: string | null
}): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return
    const supabase = createClient(url, key)
    const { error } = await supabase.from('harness_events').insert({
      event_type: ev.event_type,
      severity: ev.severity ?? 'error',
      context: ev.context ?? null,
      message: ev.message.slice(0, 2000),
      metadata: ev.metadata ?? {},
      effective_user_id: ev.effective_user_id ?? null,
    })
    // Table not created yet (Stage 2) → stay quiet; the caller already logged loud.
    // Any OTHER insert error is worth a warn (but still never throw).
    if (error && !/does not exist|Could not find the table|schema cache/i.test(error.message)) {
      console.warn('[HARNESS] logHarnessEvent insert failed:', error.message)
    }
  } catch {
    /* never throw from telemetry */
  }
}
