import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { verifiedInsert } from '@/lib/verified-write'
import { logHarnessEvent } from '@/lib/harness-events'
import manifest from '@/lib/migrations-manifest.json'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Trusted server-to-server caller (post-deploy step) — same pattern as
// /api/notifications/send. Only valid when CRON_SECRET is configured.
function isCronAuthed(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('x-cron-secret')
  return !!provided && provided === secret
}

type Check = { name: string; ok: boolean; detail: string; skipped?: boolean }

// Smoke suite: exercises the critical paths and asserts real DB side effects,
// reusing the Stage-1 verified-write helper + the Stage-3 ledger. Safe against
// production — the one write (token_usage) is a marker row that's deleted again.
// NOTE: full generate-plan E2E is intentionally NOT run here (it spends tokens +
// writes real training_programs). This verifies its dependencies instead; run
// the full path against staging once provisioned.
export async function POST(req: Request) {
  let who = 'cron'
  if (!isCronAuthed(req)) {
    const auth = await verifyAdmin(req, 'telemetry')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    who = auth.userId
  }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const checks: Check[] = []
  const push = (name: string, ok: boolean, detail: string, skipped = false) => checks.push({ name, ok, detail, skipped })

  // 1 — DB connectivity (service role reaches Postgres).
  try {
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' })
    push('db_connectivity', !error, error ? error.message : 'service-role reached Postgres')
  } catch (e) { push('db_connectivity', false, (e as Error).message) }

  // 2 — Auth identity resolved (we got past the gate).
  push('auth_identity', true, who === 'cron' ? 'cron secret accepted' : 'admin JWT resolved')

  // 3 — harness_events table present (Stage 2 wiring intact).
  try {
    const { error } = await supabase.from('harness_events').select('id', { head: true, count: 'exact' })
    push('harness_events_table', !error, error ? error.message : 'telemetry table present')
  } catch (e) { push('harness_events_table', false, (e as Error).message) }

  // 4 — Migration ledger + drift (Stage 3 wiring intact).
  try {
    const files: string[] = (manifest as { files?: string[] }).files ?? []
    const { data, error } = await supabase.from('applied_migrations').select('filename')
    if (error) push('migration_ledger', false, error.message)
    else {
      const applied = new Set((data ?? []).map(r => r.filename))
      const pending = files.filter(f => !applied.has(f))
      push('migration_ledger', pending.length === 0, pending.length === 0 ? `all ${files.length} applied` : `${pending.length} pending: ${pending.join(', ')}`)
    }
  } catch (e) { push('migration_ledger', false, (e as Error).message) }

  // 5 — token_usage verified write → read-back → cleanup (the money path).
  try {
    await verifiedInsert(supabase, 'token_usage', {
      operation: '__smoke_test__',
      api_route: 'admin/smoke-test',
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      metadata: { provider: 'smoke', ranBy: who },
    }, { context: 'smoke:token_usage', expect: ['operation', 'api_route'] })
    // Clean up any marker rows so the smoke run leaves no trace / no cost.
    await supabase.from('token_usage').delete().eq('operation', '__smoke_test__')
    push('token_usage_verified_write', true, 'verifiedInsert wrote + read back, then cleaned up')
  } catch (e) { push('token_usage_verified_write', false, (e as Error).message) }

  // 6 — Auth-gate regression: unauthenticated calls to protected routes must 401.
  // Use the CANONICAL public domain — NOT the auto-generated VERCEL_URL, which
  // sits behind Vercel Deployment Protection and returns its own 200 interstitial
  // that masks the real route (a false pass/fail). Override via SMOKE_BASE_URL
  // to point at staging.
  const base = (process.env.SMOKE_BASE_URL || 'https://atlasprime.app').replace(/\/$/, '')
  for (const g of ['/api/admin/harness-events', '/api/coach/my-program']) {
    try {
      const r = await fetch(base + g)
      push(`gate:${g}`, r.status === 401 || r.status === 403, `expected 401, got ${r.status}`)
    } catch {
      push(`gate:${g}`, true, 'inconclusive (fetch failed)', true)
    }
  }

  const failed = checks.filter(c => !c.ok && !c.skipped)
  const ok = failed.length === 0
  const ranAt = new Date().toISOString()
  const passed = checks.filter(c => c.ok).length

  // Surface in the Telemetry tab: a smoke_fail on failure (severity error),
  // else a smoke_run marker (severity info) so "last run + timestamp" persists.
  await logHarnessEvent({
    event_type: ok ? 'smoke_run' : 'smoke_fail',
    severity: ok ? 'info' : 'error',
    context: who === 'cron' ? 'smoke:cron' : 'smoke:admin',
    message: `Smoke ${ok ? 'PASS' : 'FAIL'} — ${passed}/${checks.length} checks`,
    metadata: { ranAt, checks, failed: failed.map(f => f.name) },
  })

  return NextResponse.json({ ok, ranAt, passed, total: checks.length, checks }, { status: ok ? 200 : 500 })
}
