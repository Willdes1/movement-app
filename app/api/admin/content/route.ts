import { verifyAdmin } from '@/lib/admin-auth'
import { slugify } from '@/lib/markdown'

export const runtime = 'nodejs'

// Admin CRUD for blog posts. Public reads happen server-side via lib/content.ts.

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.supabase
    .from('content_posts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posts: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  if (!b.title || !String(b.title).trim()) {
    return Response.json({ error: 'Title is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const now = new Date().toISOString()
  const ALLOWED = ['draft', 'ready', 'published']
  const status = ALLOWED.includes(b.status) ? b.status : 'draft'
  let slug = slugify(b.slug || b.title) || `post-${Date.now()}`

  const row: Record<string, unknown> = {
    title: String(b.title).trim(),
    meta_description: b.meta_description ?? null,
    excerpt: b.excerpt ?? null,
    body: b.body ?? '',
    category: b.category ?? null,
    tags: Array.isArray(b.tags) ? b.tags : [],
    cover_emoji: b.cover_emoji ?? null,
    scheduled_for: b.scheduled_for ?? null,
    status,
    updated_at: now,
  }

  if (b.id) {
    // Update existing post.
    if (status === 'published') {
      const { data: existing } = await supabase
        .from('content_posts').select('published_at').eq('id', b.id).maybeSingle()
      if (!existing?.published_at) row.published_at = now
    }
    row.slug = slug
    const { data, error } = await supabase
      .from('content_posts').update(row).eq('id', b.id).select().maybeSingle()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ post: data })
  }

  // Create — ensure the slug is unique.
  const base = slug
  for (let n = 2; ; n++) {
    const { data: clash } = await supabase
      .from('content_posts').select('id').eq('slug', slug).maybeSingle()
    if (!clash) break
    slug = `${base}-${n}`
  }
  row.slug = slug
  row.created_at = now
  if (status === 'published') row.published_at = now

  const { data, error } = await supabase
    .from('content_posts').insert(row).select().maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ post: data })
}

export async function DELETE(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })
  const { error } = await auth.supabase.from('content_posts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
