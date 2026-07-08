import { randomUUID } from 'crypto'
import { logHarnessEvent } from './harness-events'

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 (Part B) — production error reporting.
//
// Two outputs, both graceful:
//   1. Sentry — a dependency-free, DSN-gated forwarder. If SENTRY_DSN is set in
//      the environment we POST a Sentry envelope over HTTP; if it's absent we
//      no-op (exactly like the COACH_VOICE_CLONING flag pattern). This avoids a
//      heavy @sentry/nextjs install on Next 16 + Turbopack and works today.
//   2. harness_events — every wrapped route error is also written to our own
//      telemetry table (via logHarnessEvent), so the Telemetry tab shows it even
//      before Sentry is wired up.
//
// Nothing here EVER throws — telemetry must not break a request. The reporting
// only runs inside the catch of withHarness(), so the happy path (and the 60s
// Vercel budget) is untouched.
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_RE = /key|token|secret|authorization|password|cookie|session/i

/** Redact obviously-sensitive keys before anything leaves the server. */
function scrub(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) out[k] = SECRET_RE.test(k) ? '[scrubbed]' : v
  return out
}

/** Parse a Sentry DSN into its ingest URL + public key. Returns null if malformed. */
function parseDsn(dsn: string): { ingestUrl: string; publicKey: string } | null {
  try {
    const u = new URL(dsn)
    const publicKey = u.username
    const projectId = u.pathname.replace(/^\//, '')
    if (!publicKey || !projectId) return null
    return { ingestUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, publicKey }
  } catch {
    return null
  }
}

/**
 * Forward an exception to Sentry if (and only if) SENTRY_DSN is configured.
 * No-ops silently otherwise. Timeout-bounded so it can never hang a request.
 */
export async function captureException(
  err: Error,
  ctx: { route?: string; extra?: Record<string, unknown> } = {},
): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return // graceful: nothing configured yet
  try {
    const parsed = parseDsn(dsn)
    if (!parsed) return
    const eventId = randomUUID().replace(/-/g, '')
    const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn })
    const itemHeader = JSON.stringify({ type: 'event' })
    const payload = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level: 'error',
      environment: process.env.VERCEL_ENV || 'development',
      logger: 'harness',
      transaction: ctx.route,
      exception: { values: [{ type: err.name || 'Error', value: String(err.message ?? err).slice(0, 1000) }] },
      tags: { route: ctx.route ?? 'unknown' },
      extra: scrub(ctx.extra ?? {}),
    })
    const envelope = `${header}\n${itemHeader}\n${payload}`

    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 3000)
    await fetch(parsed.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=atlas-prime-harness/1.0`,
      },
      body: envelope,
      signal: ctl.signal,
    }).catch(() => {}) // network failure must not surface
    clearTimeout(t)
  } catch {
    /* never throw from telemetry */
  }
}

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response> | Response

/**
 * Wrap a route handler so any thrown error is reported to BOTH Sentry (if
 * configured) AND harness_events (event_type='route_error'), then a clean 500
 * is returned. The reporting only runs on the error path.
 *
 * Usage:
 *   export const POST = withHarness('admin/thing', async (req) => { ... })
 */
export function withHarness(routeName: string, handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      await captureException(e, { route: routeName })
      await logHarnessEvent({
        event_type: 'route_error',
        severity: 'error',
        context: routeName,
        message: e.message || 'Unknown route error',
        metadata: { name: e.name, stack: e.stack?.slice(0, 1500) },
      })
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
  }
}
