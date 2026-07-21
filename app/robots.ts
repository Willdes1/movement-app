import type { MetadataRoute } from 'next'

// Allow crawling of the public site; keep bots out of the admin portal and API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
    sitemap: 'https://atlasprime.app/sitemap.xml',
    host: 'https://atlasprime.app',
  }
}
