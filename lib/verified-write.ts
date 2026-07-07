import { SupabaseClient } from '@supabase/supabase-js'
import { logHarnessEvent } from './harness-events'

// ─────────────────────────────────────────────────────────────────────────────
// Read-after-write verification for money / critical-state writes.
//
// Perform a service-role insert/update/upsert, then READ THE ROW BACK and assert
// the key fields actually persisted. On any failure — rejected write, empty
// read-back, or field mismatch — we log LOUDLY (console.error with a stable
// [VERIFY_FAIL] prefix + a harness_events row) and THROW a structured VerifyError.
//
// This exists because logTokens() once wrote to a non-existent column with the
// wrong key and every insert was silently swallowed by .catch(). With these
// helpers a broken write becomes a loud, tracked failure instead of a silent one.
//
// Contract: the helper ALWAYS logs loud + throws on failure. Whether a caller
// re-throws (aborting the request) or contains it (loud but keep going) is a
// per-call-site decision — see the retrofits.
// ─────────────────────────────────────────────────────────────────────────────

export const VERIFY_PREFIX = '[VERIFY_FAIL]'

export class VerifyError extends Error {
  constructor(
    public table: string,
    public context: string,
    public reason: string,
    public detail?: Record<string, unknown>,
  ) {
    super(`${VERIFY_PREFIX} ${table} (${context}): ${reason}`)
    this.name = 'VerifyError'
  }
}

type Opts = {
  /** Stable label for logs + telemetry, e.g. "logTokens:seed_library". */
  context?: string
  /** Which columns to assert on the read-back row (default: all payload keys). */
  expect?: string[]
  /** Extra equality filters applied to the write + read-back (e.g. a user_id guard). */
  match?: Record<string, unknown>
  /** For attributing the failure to a user in telemetry. */
  effectiveUserId?: string | null
}

// Loose scalar equality — PostgREST can return numbers/dates as strings, so
// compare stringified scalars; never assert on objects/arrays (jsonb columns).
function scalarEq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined
  if (typeof a === 'object' || typeof b === 'object') return true
  return String(a) === String(b)
}

function summarize(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) out[k] = v && typeof v === 'object' ? '[obj]' : v
  return out
}

async function fail(
  table: string, context: string, reason: string,
  detail: Record<string, unknown>, euid?: string | null,
): Promise<never> {
  console.error(`${VERIFY_PREFIX} ${table} (${context}): ${reason}`, detail)
  await logHarnessEvent({
    event_type: 'verify_fail', severity: 'critical',
    context: `${table}:${context}`, message: reason,
    metadata: detail, effective_user_id: euid ?? null,
  })
  throw new VerifyError(table, context, reason, detail)
}

function mismatchedKeys(readBack: Record<string, unknown>, payload: Record<string, unknown>, expect?: string[]): string[] {
  const keys = expect ?? Object.keys(payload)
  return keys.filter(k => !scalarEq(readBack[k], payload[k]))
}

/** INSERT one row, read it back by id, assert key fields persisted. Throws loudly on failure. */
export async function verifiedInsert<T extends Record<string, any> = any>(
  supabase: SupabaseClient, table: string, row: Record<string, unknown>, opts: Opts = {},
): Promise<T> {
  const context = opts.context ?? 'insert'
  const { data: written, error } = await supabase.from(table).insert(row).select().single()
  if (error || !written) {
    // The INSERT…RETURNING failed. Two possibilities: a GENUINE rejected write
    // (bad column, constraint, RLS) — or merely a missing SELECT grant that
    // blocks the RETURNING on an otherwise-valid insert (token_usage is locked
    // down exactly this way: service_role has INSERT but not SELECT). Distinguish
    // by retrying a plain insert with no RETURNING. Postgres rolled back the
    // failed RETURNING statement, so this cannot double-write.
    const { error: plainErr } = await supabase.from(table).insert(row)
    if (plainErr) {
      // Genuinely can't write → loud + throw (the whole point of the harness).
      return fail(table, context, `insert rejected: ${plainErr.message}`, { row: summarize(row) }, opts.effectiveUserId)
    }
    // Row landed; we just couldn't read it back (no SELECT grant). Not silent —
    // a visible warning — but don't fail the write or spam telemetry per call.
    console.warn(`[VERIFY_DEGRADED] ${table} (${context}): write ok, read-back unavailable — grant SELECT to service_role to restore full verification (${error?.message ?? 'no row returned'})`)
    return row as T
  }
  const id = (written as Record<string, unknown>).id
  if (id == null) return written as T // no id PK — trust the RETURNING row
  const { data: readBack, error: readErr } = await supabase.from(table).select().eq('id', id).single()
  if (readErr || !readBack) {
    return fail(table, context, `read-after-write empty: ${readErr?.message ?? 'row not found'}`, { id }, opts.effectiveUserId)
  }
  const bad = mismatchedKeys(readBack as Record<string, unknown>, row, opts.expect)
  if (bad.length) return fail(table, context, `field mismatch after insert: ${bad.join(', ')}`, { id, bad }, opts.effectiveUserId)
  return readBack as T
}

/** UPDATE by id (+ optional match guard), read it back, assert patched fields persisted. Throws loudly on failure. */
export async function verifiedUpdate<T extends Record<string, any> = any>(
  supabase: SupabaseClient, table: string, id: string, patch: Record<string, unknown>, opts: Opts = {},
): Promise<T> {
  const context = opts.context ?? 'update'
  const match = opts.match ?? {}
  let upd = supabase.from(table).update(patch).eq('id', id)
  for (const [k, v] of Object.entries(match)) upd = upd.eq(k, v)
  const { data: written, error } = await upd.select().single()
  if (error || !written) {
    return fail(table, context, `update rejected / no row matched: ${error?.message ?? 'no row returned'}`, { id, patch: summarize(patch) }, opts.effectiveUserId)
  }
  let rb = supabase.from(table).select().eq('id', id)
  for (const [k, v] of Object.entries(match)) rb = rb.eq(k, v)
  const { data: readBack, error: readErr } = await rb.single()
  if (readErr || !readBack) {
    return fail(table, context, `read-after-write empty: ${readErr?.message ?? 'row not found'}`, { id }, opts.effectiveUserId)
  }
  const bad = mismatchedKeys(readBack as Record<string, unknown>, patch, opts.expect)
  if (bad.length) return fail(table, context, `field mismatch after update: ${bad.join(', ')}`, { id, bad }, opts.effectiveUserId)
  return readBack as T
}

/** UPSERT on a conflict target, read the row back by id, assert key fields persisted. Throws loudly on failure. */
export async function verifiedUpsert<T extends Record<string, any> = any>(
  supabase: SupabaseClient, table: string, row: Record<string, unknown>,
  opts: Opts & { onConflict: string },
): Promise<T> {
  const context = opts.context ?? 'upsert'
  const { data: written, error } = await supabase.from(table).upsert(row, { onConflict: opts.onConflict }).select().single()
  if (error || !written) {
    return fail(table, context, `upsert rejected: ${error?.message ?? 'no row returned'}`, { row: summarize(row) }, opts.effectiveUserId)
  }
  const id = (written as Record<string, unknown>).id
  if (id == null) return written as T
  const { data: readBack, error: readErr } = await supabase.from(table).select().eq('id', id).single()
  if (readErr || !readBack) {
    return fail(table, context, `read-after-write empty: ${readErr?.message ?? 'row not found'}`, { id }, opts.effectiveUserId)
  }
  const bad = mismatchedKeys(readBack as Record<string, unknown>, row, opts.expect)
  if (bad.length) return fail(table, context, `field mismatch after upsert: ${bad.join(', ')}`, { id, bad }, opts.effectiveUserId)
  return readBack as T
}
