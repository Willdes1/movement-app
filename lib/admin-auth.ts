import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type AdminAuthOk = { ok: true; supabase: SupabaseClient; userId: string; isOwner: boolean }
export type AdminAuthFail = { ok: false; status: 401 | 403; error: string }

/** Resolve the caller's JWT to a user id, or null. */
async function resolveUser(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const anonClient = createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await anonClient.auth.getUser()
  return user?.id ?? null
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
  const userId = await resolveUser(req)
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' }

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

/** Owner-only gate (e.g. managing partner permissions). Partners are rejected. */
export async function verifyOwner(req: Request): Promise<AdminAuthOk | AdminAuthFail> {
  const userId = await resolveUser(req)
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_owner').eq('id', userId).single()
  if (profile?.is_admin || profile?.is_owner) return { ok: true, supabase, userId, isOwner: true }
  return { ok: false, status: 403, error: 'Owner only' }
}
