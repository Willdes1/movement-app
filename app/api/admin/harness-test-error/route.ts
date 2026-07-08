import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { withHarness } from '@/lib/observability'

export const runtime = 'nodejs'
export const maxDuration = 60

// Stage-2 verification: fire a deliberate error THROUGH the harness wrapper so
// you can confirm it lands in BOTH Sentry (if SENTRY_DSN is set) and the
// Telemetry tab (a harness_events route_error row). Returns 500 by design —
// that's the honest result of a thrown route error; the UI treats it as "fired".
export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'telemetry')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return withHarness('admin/harness-test-error', async () => {
    throw new Error('Harness test error — fired intentionally from the Telemetry tab')
  })(req)
}
