import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type AdminAuthOk = { ok: true; supabase: SupabaseClient; userId: string; isOwner: boolean }
export type AdminAuthFail = { ok: false; status: 401 | 403; error: string }

/** Resolve the caller's JWT to their verified id and email, or null. */
async function resolveUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const anonClient = createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await anonClient.auth.getUser()
  return user?.id ? { id: user.id, email: user.email ?? null } : null
}

/**
 * Verifies the caller may use an admin route.
 *
 * Access is granted to:
 *   • OWNERS (profiles.is_admin OR profiles.is_owner) — full access, any tab.
 *   • PARTNERS — an active admin_permissions row whose allowed_tabs includes
 *     `requiredTab` (when a tab is specified).
 *
 * Returns a ready service-role Supabase client on success.
 */
export async function verifyAdmin(req: Request, requiredTab?: string): Promise<AdminAuthOk | AdminAuthFail> {
  const caller = await resolveUser(req)
  if (!caller) return { ok: false, status: 401, error: 'Unauthorized' }
  const userId = caller.id

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  const { data: profile } = await supabase.from('profiles').select('is_admin, is_owner').eq('id', userId).single()
  if (profile?.is_admin || profile?.is_owner) return { ok: true, supabase, userId, isOwner: true }

  // Partner path — must have an active permission row (and the tab, if required).
  const { data: perm } = await supabase
    .from('admin_permissions')
    .select('allowed_tabs, active')
    .eq('user_id', userId)
    .single()
  if (perm?.active && (!requiredTab || (perm.allowed_tabs ?? []).includes(requiredTab))) {
    return { ok: true, supabase, userId, isOwner: false }
  }

  return { ok: false, status: 403, error: 'Admin only' }
}

export type UserAuthOk = { ok: true; supabase: SupabaseClient; userId: string; email: string | null }

/**
 * Signed-in-user gate for routes that spend money or write on someone's behalf.
 *
 * The user id comes from the verified JWT and NOTHING else. Several routes used
 * to read `userId` out of the request body, which let any caller act as any
 * user; body-supplied ids must be ignored in favour of this one.
 *
 * Returns a service-role client so the route can read/write past RLS once the
 * caller's identity is established.
 */
export async function verifyUser(req: Request): Promise<UserAuthOk | AdminAuthFail> {
  const caller = await resolveUser(req)
  if (!caller) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true, supabase: createClient(SUPA_URL, SERVICE_KEY), userId: caller.id, email: caller.email }
}

/**
 * Identity for routes that write on a user's behalf AND must keep working
 * during admin "Zoom In" impersonation.
 *
 * Rules:
 *   • No body id, or it matches the caller  → act as the caller.
 *   • Body id differs and the caller is an admin/owner → act as that user
 *     (this is impersonation, and it is the only legitimate reason to differ).
 *   • Body id differs and the caller is not an admin → 403.
 *
 * Before this existed the body id was simply trusted, so any caller could write
 * streaks, push subscriptions or coach-roster rows for any account.
 */
export async function resolveActingUser(req: Request, bodyUserId?: unknown): Promise<UserAuthOk | AdminAuthFail> {
  const caller = await resolveUser(req)
  if (!caller) return { ok: false, status: 401, error: 'Unauthorized' }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const target = typeof bodyUserId === 'string' && bodyUserId ? bodyUserId : caller.id
  if (target === caller.id) return { ok: true, supabase, userId: caller.id, email: caller.email }

  const { data: profile } = await supabase.from('profiles').select('is_admin, is_owner').eq('id', caller.id).single()
  if (profile?.is_admin || profile?.is_owner) return { ok: true, supabase, userId: target, email: null }

  return { ok: false, status: 403, error: 'Cannot act for another user' }
}

/** Owner-only gate (e.g. managing partner permissions). Partners are rejected. */
export async function verifyOwner(req: Request): Promise<AdminAuthOk | AdminAuthFail> {
  const caller = await resolveUser(req)
  if (!caller) return { ok: false, status: 401, error: 'Unauthorized' }
  const userId = caller.id

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_owner').eq('id', userId).single()
  if (profile?.is_admin || profile?.is_owner) return { ok: true, supabase, userId, isOwner: true }
  return { ok: false, status: 403, error: 'Owner only' }
}
