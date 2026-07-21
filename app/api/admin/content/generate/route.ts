import { verifyAdmin } from '@/lib/admin-auth'
import { generateArticleDraft } from '@/lib/content-generate'

export const runtime = 'nodejs'
export const maxDuration = 120

// One-click article generation for the admin. Topic is optional; blank lets the
// engine choose a fresh, unpublished topic. Returns a draft for review (unsaved).
export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const { draft, grounded, usage } = await generateArticleDraft(auth.supabase, {
      clusterId: body.cluster,
      topic: body.topic,
      angle: body.angle,
      route: '/api/admin/content/generate',
      userId: auth.userId,
    })
    return Response.json({ draft, grounded, usage })
  } catch (err) {
    console.error('content generate error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
