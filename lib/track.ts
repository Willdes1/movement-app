import { supabase } from '@/lib/supabase'

// Client-side product-telemetry helper. Fire-and-forget: records a customer
// click-through / action to product_events via /api/track. NEVER blocks the UI
// and NEVER throws — analytics must not break the app.
//
// Usage (call sites don't await):
//   import { trackEvent } from '@/lib/track'
//   trackEvent('generate_plan_click', { sport })
//
// page_view is fired automatically by <ProductTracker> on every route change.

const SESSION_KEY = 'ap_track_session'

// Stable anon session id so logged-out traffic can still be grouped into a funnel.
function sessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let s = localStorage.getItem(SESSION_KEY)
    if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s) }
    return s
  } catch { return '' }
}

export async function trackEvent(event_name: string, metadata: Record<string, unknown> = {}): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    // Optional auth — lets the server attribute the event to a user + role.
    let token: string | undefined
    try { token = (await supabase.auth.getSession()).data.session?.access_token } catch { /* logged out */ }

    await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ event_name, path: window.location.pathname, session_id: sessionId(), metadata }),
      keepalive: true, // survives page navigation/unload
    }).catch(() => {})
  } catch {
    /* swallow — never break the app for a telemetry write */
  }
}
