import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type AdminAuthOk = { ok: true; supabase: SupabaseClient; userId: string }
export type AdminAuthFail = { ok: false; status: 401 | 403; error: string }

/**
 * Verifies the caller is an authenticated admin.
 *
 * 1. Reads the Bearer JWT, resolves the user via the anon client (caller auth).
 * 2. Confirms `profiles.is_admin` using the service-role client (bypasses RLS).
 *
 * On success returns a ready-to-use service-role Supabase client so callers can
 * read/write the Study Hub tables (which are RLS deny-by-default for everyone
 * except the service role). On failure returns a status + message to return.
 */
export async function verifyAdmin(req: Request): Promise<AdminAuthOk | AdminAuthFail> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }

  const anonClient = createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { ok: false, status: 403, error: 'Admin only' }

  return { ok: true, supabase, userId: user.id }
}
