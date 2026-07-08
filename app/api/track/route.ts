import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Public clickstream ingest — accepts anonymous events (pre-signup traffic), so
// it is intentionally NOT gated. It only ever writes to product_events, and all
// inputs are length-capped. Returns 204 no matter what (analytics must never
// surface an error to the client).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body.event_name !== 'string' || !body.event_name.trim()) {
      return new Response(null, { status: 204 })
    }

    const event_name = body.event_name.slice(0, 80)
    const path = typeof body.path === 'string' ? body.path.slice(0, 300) : null
    const session_id = typeof body.session_id === 'string' ? body.session_id.slice(0, 100) : null
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}

    const svc = createClient(SUPA_URL, SERVICE_KEY)

    // Optional attribution: resolve the user + role from the bearer token if sent.
    let user_id: string | null = null
    let role: string | null = null
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      const anon = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: { user } } = await anon.auth.getUser()
      user_id = user?.id ?? null
      if (user_id) {
        const { data: prof } = await svc.from('profiles').select('role').eq('id', user_id).single()
        role = (prof as { role?: string } | null)?.role ?? null
      }
    }

    await svc.from('product_events').insert({ event_name, path, user_id, role, session_id, metadata })
    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 204 })
  }
}
