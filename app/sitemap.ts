import type { MetadataRoute } from 'next'

// Public, crawlable pages only. Authenticated app routes (/today, /coach/*, /admin)
// are intentionally excluded — they require login and carry no SEO value.
const BASE = 'https://atlasprime.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/auth`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
