import Link from 'next/link'
import type { Metadata } from 'next'
import BlogShell from '@/components/blog/BlogShell'
import { getPublishedPosts } from '@/lib/content'
import { clusterLabel } from '@/lib/content-clusters'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Training and Coaching Insights',
  description:
    'Practical, honest guides on AI training, coaching software, recovery, and sport-specific programming from the Atlas Prime team.',
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: 'https://atlasprime.app/blog',
    title: 'The Atlas Prime Blog',
    description: 'Practical guides on AI training, coaching, recovery, and sport-specific programming.',
  },
}

export default async function BlogIndex() {
  const posts = await getPublishedPosts()

  return (
    <BlogShell>
      <div className="apb-hero">
        <span className="apb-eyebrow">The Atlas Prime blog</span>
        <h1>Train smarter. Coach better.</h1>
        <p className="apb-sub">
          Practical, honest guides on AI training, coaching, recovery, and sport-specific programming.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="apb-empty">New articles are on the way. Check back soon.</p>
      ) : (
        <div className="apb-grid">
          {posts.map(p => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="apb-card">
              <div className="apb-card-emoji">{p.cover_emoji ?? '📝'}</div>
              {p.category && <span className="apb-card-cat">{clusterLabel(p.category)}</span>}
              <h2>{p.title}</h2>
              <p>{p.excerpt ?? p.meta_description}</p>
            </Link>
          ))}
        </div>
      )}
    </BlogShell>
  )
}
