import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// Recent harness_events for the Telemetry tab (newest first). Admin-only.
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'telemetry')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sentryConfigured = !!process.env.SENTRY_DSN

  const { data, error } = await auth.supabase
    .from('harness_events')
    .select('id, created_at, event_type, severity, context, message, metadata, effective_user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    // Stage-2 migration not applied yet → tell the UI gently instead of erroring.
    if (/does not exist|schema cache|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ events: [], pendingMigration: true, sentryConfigured })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [], sentryConfigured })
}
