import type { MetadataRoute } from 'next'
import { getPublishedPosts } from '@/lib/content'

// Public, crawlable pages only. Authenticated app routes (/today, /coach/*, /admin)
// are intentionally excluded — they require login and carry no SEO value.
const BASE = 'https://atlasprime.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/auth`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Published blog posts (best-effort; a DB hiccup must not break the sitemap).
  let postPages: MetadataRoute.Sitemap = []
  try {
    const posts = await getPublishedPosts()
    postPages = posts.map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch (err) {
    console.error('sitemap: failed to load posts', err)
  }

  return [...staticPages, ...postPages]
}
