import { supabase } from '@/lib/supabase'

// Client-side fetch that carries the caller's Supabase JWT.
//
// Every API route that spends money, touches another user's data, or writes
// with the service-role key is gated server-side (verifyAdmin / auth.getUser).
// Those gates only work if the browser actually sends the token, so this is the
// single place that attaches it. Use it instead of bare `fetch` for any
// /api/... call that is not deliberately public.
//
// Deliberately does NOT throw when there is no session: the route answers 401
// and the caller's existing error handling deals with it, which keeps this drop
// in for the ~45 call sites that used plain fetch before the auth sweep.

export async function authHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> | undefined),
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }
}

/** `fetch`, plus the caller's bearer token. Same signature and return value. */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, headers: await authHeaders(init.headers) })
}
