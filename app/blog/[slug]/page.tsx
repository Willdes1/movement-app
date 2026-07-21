import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BlogShell from '@/components/blog/BlogShell'
import { getPostBySlug, getPublishedPosts } from '@/lib/content'
import { renderMarkdown, readingTime } from '@/lib/markdown'
import { clusterLabel } from '@/lib/content-clusters'

export const revalidate = 300

export async function generateStaticParams() {
  const posts = await getPublishedPosts()
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'Article not found' }
  const description = post.meta_description ?? post.excerpt ?? undefined
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      url: `https://atlasprime.app/blog/${post.slug}`,
      title: post.title,
      description,
      publishedTime: post.published_at ?? undefined,
    },
    twitter: { card: 'summary_large_image', title: post.title, description },
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const html = renderMarkdown(post.body ?? '')
  const mins = readingTime(post.body ?? '')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description ?? post.excerpt ?? '',
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: 'Atlas Prime' },
    publisher: { '@type': 'Organization', name: 'Atlas Prime' },
    mainEntityOfPage: `https://atlasprime.app/blog/${post.slug}`,
  }

  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="apb-article">
        <Link href="/blog" className="apb-back">&larr; All articles</Link>
        {post.category && <span className="apb-card-cat">{clusterLabel(post.category)}</span>}
        <h1>{post.title}</h1>
        <div className="apb-meta">
          {mins} min read{post.published_at ? ` · ${fmtDate(post.published_at)}` : ''}
        </div>
        <div className="apb-body" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="apb-cta">
          <h3>Train like you mean it.</h3>
          <p>Get your own AI program, or coach your whole roster from one place.</p>
          <Link href="/auth" className="apb-btn">Start free</Link>
        </div>
      </article>
    </BlogShell>
  )
}
