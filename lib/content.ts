import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-only data helpers for the public blog. Uses the service role key, so
// this module must never be imported into a client component.

export type ContentPost = {
  id: string
  slug: string
  title: string
  meta_description: string | null
  excerpt: string | null
  body: string | null
  category: string | null
  tags: string[]
  cover_emoji: string | null
  status: string
  author: string
  published_at: string | null
  created_at: string
  updated_at: string
}

// Returns null when env is missing (e.g. local build without the service key) so
// blog pages degrade to empty instead of crashing the whole build.
function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function getPublishedPosts(): Promise<ContentPost[]> {
  const db = admin()
  if (!db) return []
  const { data, error } = await db
    .from('content_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error) { console.error('getPublishedPosts:', error.message); return [] }
  return (data as ContentPost[]) ?? []
}

export async function getPostBySlug(slug: string): Promise<ContentPost | null> {
  const db = admin()
  if (!db) return null
  const { data, error } = await db
    .from('content_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) { console.error('getPostBySlug:', error.message); return null }
  return (data as ContentPost) ?? null
}
