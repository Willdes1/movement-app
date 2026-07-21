import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateArticleDraft } from '@/lib/content-generate'
import { slugify } from '@/lib/markdown'
import { CONTENT_CLUSTERS } from '@/lib/content-clusters'

export const runtime = 'nodejs'
export const maxDuration = 60

// Content auto-pilot. Runs daily (see vercel.json). Each run:
//   1. publishes any post pinned with scheduled_for that is now due
//   2. on a configured publish day, drips out the oldest 'ready' post
//   3. tops up the draft buffer (max 1 per run) so there is always something
//      awaiting your approval
// Secured by CRON_SECRET. Vercel Cron sends `Authorization: Bearer <secret>`;
// the x-cron-secret header is also accepted for manual/script triggers.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true
  if (req.headers.get('x-cron-secret') === secret) return true
  return false
}

function service(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Settings = { auto_generate: boolean; publish_days: number[]; queue_target: number; clusters: string[] }

async function loadSettings(db: SupabaseClient): Promise<Settings> {
  const { data } = await db.from('content_settings').select('*').eq('id', 'default').maybeSingle()
  return {
    auto_generate: data?.auto_generate ?? true,
    publish_days: data?.publish_days ?? [2, 5],
    queue_target: data?.queue_target ?? 4,
    clusters: data?.clusters?.length ? data.clusters : CONTENT_CLUSTERS.map(c => c.id),
  }
}

async function publish(db: SupabaseClient, id: string, nowIso: string) {
  await db.from('content_posts').update({ status: 'published', published_at: nowIso, updated_at: nowIso }).eq('id', id)
}

// Pick the configured cluster with the fewest posts so coverage stays balanced.
async function pickCluster(db: SupabaseClient, clusters: string[]): Promise<string> {
  let best = clusters[0], bestCount = Infinity
  for (const id of clusters) {
    const { count } = await db.from('content_posts').select('id', { count: 'exact', head: true }).eq('category', id)
    if ((count ?? 0) < bestCount) { bestCount = count ?? 0; best = id }
  }
  return best
}

async function insertDraft(db: SupabaseClient, draft: { title: string; meta_description: string; excerpt: string; body: string; tags: string[]; cover_emoji: string; category: string }) {
  let slug = slugify(draft.title) || `post-${Date.now()}`
  const base = slug
  for (let n = 2; ; n++) {
    const { data: clash } = await db.from('content_posts').select('id').eq('slug', slug).maybeSingle()
    if (!clash) break
    slug = `${base}-${n}`
  }
  const now = new Date().toISOString()
  await db.from('content_posts').insert({
    slug, title: draft.title, meta_description: draft.meta_description, excerpt: draft.excerpt,
    body: draft.body, category: draft.category, tags: draft.tags, cover_emoji: draft.cover_emoji,
    status: 'draft', created_at: now, updated_at: now,
  })
}

async function run(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const settings = await loadSettings(db)
  const nowIso = new Date().toISOString()
  const published: string[] = []
  let generated = 0

  // 1. Pinned posts that are due (any day).
  const { data: due } = await db.from('content_posts')
    .select('id, slug').lte('scheduled_for', nowIso)
    .in('status', ['ready', 'scheduled']).not('scheduled_for', 'is', null)
    .order('scheduled_for', { ascending: true })
  for (const p of due ?? []) { await publish(db, p.id, nowIso); published.push(p.slug) }

  // 2. Drip: on a publish day, send out the oldest un-pinned 'ready' post.
  const dow = new Date().getUTCDay() // 0=Sun..6=Sat (UTC; cron runs in UTC)
  if (settings.publish_days.includes(dow)) {
    const { data: next } = await db.from('content_posts')
      .select('id, slug').eq('status', 'ready').is('scheduled_for', null)
      .order('created_at', { ascending: true }).limit(1)
    if (next?.[0]) { await publish(db, next[0].id, nowIso); published.push(next[0].slug) }
  }

  // 3. Top up the draft buffer (max 1 per run to respect the 60s wall + cost).
  if (settings.auto_generate) {
    const { count } = await db.from('content_posts').select('id', { count: 'exact', head: true }).eq('status', 'draft')
    if ((count ?? 0) < settings.queue_target) {
      try {
        const clusterId = await pickCluster(db, settings.clusters)
        const { draft } = await generateArticleDraft(db, { clusterId, route: '/api/cron/content' })
        if (draft.title && draft.body) { await insertDraft(db, draft); generated = 1 }
      } catch (err) { console.error('cron auto-generate failed:', err) }
    }
  }

  return Response.json({ ok: true, published, generated, ran_at: nowIso })
}

// Vercel Cron invokes via GET; POST kept for manual/script triggers.
export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }
