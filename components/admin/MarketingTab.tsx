'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CONTENT_CLUSTERS, clusterLabel } from '@/lib/content-clusters'

// ─── Marketing hub. Phase 1 = the Content Engine (public /blog). Lead
//     Investigation + Ads (TODO #6) are previewed as "coming next". ──────────────
const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#FF5C35', accentDim: 'rgba(255,92,53,0.12)', accentBorder: 'rgba(255,92,53,0.35)',
  blue: '#3b82f6', green: '#22c55e', greenDim: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', red: '#ef4444',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Post = {
  id: string; slug: string; title: string; meta_description: string | null
  excerpt: string | null; body: string | null; category: string | null
  tags: string[]; cover_emoji: string | null; status: string
  published_at: string | null; updated_at: string
}

type Draft = {
  id?: string; title: string; slug: string; meta_description: string; excerpt: string
  body: string; category: string; tags: string; cover_emoji: string; status: string
}

const EMPTY: Draft = {
  title: '', slug: '', meta_description: '', excerpt: '', body: '',
  category: 'coach-software', tags: '', cover_emoji: '📝', status: 'draft',
}

async function authFetch(input: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init?.headers ?? {}) },
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

type Settings = { auto_generate: boolean; publish_days: number[]; queue_target: number; clusters: string[] }
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function statusMeta(status: string) {
  if (status === 'published') return { label: 'published', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' }
  if (status === 'ready') return { label: 'queued', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' }
  return { label: 'draft', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
}

export default function MarketingTab() {
  const [posts, setPosts] = useState<Post[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [cluster, setCluster] = useState('coach-software')
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const activeCluster = CONTENT_CLUSTERS.find(c => c.id === cluster) ?? CONTENT_CLUSTERS[0]
  const [settings, setSettings] = useState<Settings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const readyPosts = posts.filter(p => p.status === 'ready')

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      authFetch('/api/admin/content'),
      authFetch('/api/admin/content/settings'),
    ])
    const pj = await pRes.json().catch(() => ({}))
    if (pRes.ok) setPosts(pj.posts ?? [])
    const sj = await sRes.json().catch(() => ({}))
    if (sRes.ok) setSettings(sj.settings)
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 4000) }

  const generate = async () => {
    setGenerating(true); setMsg(null)
    try {
      const res = await authFetch('/api/admin/content/generate', {
        method: 'POST', body: JSON.stringify({ topic, cluster, angle }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { flash('err', json.error ?? 'Generation failed'); return }
      const d = json.draft
      setDraft({
        title: d.title ?? '', slug: '', meta_description: d.meta_description ?? '',
        excerpt: d.excerpt ?? '', body: d.body ?? '', category: d.category ?? cluster,
        tags: Array.isArray(d.tags) ? d.tags.join(', ') : '', cover_emoji: d.cover_emoji ?? '📝',
        status: 'draft',
      })
      flash('ok', json.grounded ? `Draft ready (grounded in ${json.grounded} knowledge items). Review, then publish.` : 'Draft ready. Review, then publish.')
    } finally { setGenerating(false) }
  }

  const save = async (status: 'draft' | 'ready' | 'published') => {
    if (!draft) return
    if (!draft.title.trim()) { flash('err', 'Title is required.'); return }
    setSaving(true)
    try {
      const res = await authFetch('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          id: draft.id, title: draft.title, slug: draft.slug, meta_description: draft.meta_description,
          excerpt: draft.excerpt, body: draft.body, category: draft.category,
          tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
          cover_emoji: draft.cover_emoji, status,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { flash('err', json.error ?? 'Save failed'); return }
      flash('ok', status === 'published' ? 'Published live to /blog.' : status === 'ready' ? 'Approved into the drip queue.' : 'Draft saved.')
      setDraft({ ...draft, id: json.post.id, slug: json.post.slug, status: json.post.status })
      load()
    } finally { setSaving(false) }
  }

  // Lightweight status change from the list (approve draft → ready, or back).
  const setPostStatus = async (p: Post, status: string) => {
    const res = await authFetch('/api/admin/content', {
      method: 'POST',
      body: JSON.stringify({
        id: p.id, title: p.title, slug: p.slug, meta_description: p.meta_description,
        excerpt: p.excerpt, body: p.body, category: p.category, tags: p.tags,
        cover_emoji: p.cover_emoji, status,
      }),
    })
    if (res.ok) { flash('ok', status === 'ready' ? 'Approved into the drip queue.' : status === 'draft' ? 'Moved back to draft.' : 'Updated.'); load() }
    else flash('err', 'Update failed')
  }

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!settings) return
    const next = { ...settings, ...patch }
    setSettings(next)
    setSavingSettings(true)
    try {
      const res = await authFetch('/api/admin/content/settings', { method: 'POST', body: JSON.stringify(next) })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.settings) setSettings(json.settings)
      else flash('err', json.error ?? 'Settings save failed')
    } finally { setSavingSettings(false) }
  }
  const toggleDay = (d: number) => {
    if (!settings) return
    const has = settings.publish_days.includes(d)
    updateSettings({ publish_days: has ? settings.publish_days.filter(x => x !== d) : [...settings.publish_days, d].sort((a, b) => a - b) })
  }

  const edit = (p: Post) => {
    setDraft({
      id: p.id, title: p.title, slug: p.slug, meta_description: p.meta_description ?? '',
      excerpt: p.excerpt ?? '', body: p.body ?? '', category: p.category ?? 'coach-software',
      tags: (p.tags ?? []).join(', '), cover_emoji: p.cover_emoji ?? '📝', status: p.status,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id: string) => {
    if (!confirm('Delete this post permanently?')) return
    const res = await authFetch(`/api/admin/content?id=${id}`, { method: 'DELETE' })
    if (res.ok) { flash('ok', 'Deleted.'); if (draft?.id === id) setDraft(null); load() }
    else flash('err', 'Delete failed')
  }

  const input: React.CSSProperties = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  }
  const labelSt: React.CSSProperties = { fontSize: 12, color: C.textDim, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }

  return (
    <div style={{ color: C.text }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Marketing</h1>
      <p style={{ color: C.textMid, margin: '0 0 24px', fontSize: 14 }}>
        The growth hub. Live now: the Content Engine that publishes SEO articles to your public blog, grounded in the Atlas Prime knowledge engine.
      </p>

      {msg && (
        <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          background: msg.kind === 'ok' ? C.greenDim : 'rgba(239,68,68,0.12)',
          border: `1px solid ${msg.kind === 'ok' ? C.green : C.red}`, color: msg.kind === 'ok' ? C.green : C.red }}>
          {msg.text}
        </div>
      )}

      {/* ── GENERATE ────────────────────────────────────────────────────── */}
      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 750, margin: '0 0 4px' }}>✨ One-click article</h2>
        <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 16px' }}>
          Pick a category and hit generate. The engine picks a fresh, unpublished SEO topic and writes an expert, human-voiced draft. You review and publish. Two a week beats daily filler.
        </p>

        <label style={labelSt}>Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {CONTENT_CLUSTERS.map(c => {
            const on = cluster === c.id
            return (
              <button key={c.id} onClick={() => setCluster(c.id)} style={{
                background: on ? C.accentDim : C.bg, border: `1px solid ${on ? C.accentBorder : C.border}`,
                color: on ? C.accent : C.textMid, borderRadius: 20, padding: '8px 15px', fontSize: 13.5,
                fontWeight: 650, cursor: 'pointer' }}>
                {c.emoji} {c.label}
              </button>
            )
          })}
        </div>

        <button onClick={generate} disabled={generating} style={{
          width: '100%', background: C.accent, color: '#0c0c0f', border: 0, borderRadius: 10, padding: '15px 22px',
          fontSize: 15.5, fontWeight: 800, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
          {generating ? 'Writing your article…' : `✨ Generate a ${activeCluster.label} article`}
        </button>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', color: C.textDim, fontSize: 12.5, fontWeight: 600, userSelect: 'none' }}>
            Optional: steer the topic yourself
          </summary>
          <div style={{ marginTop: 12 }}>
            <label style={labelSt}>Specific topic (optional)</label>
            <input style={{ ...input, marginBottom: 12 }} value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="Leave blank to let the engine choose" />
            <label style={labelSt}>Angle (optional)</label>
            <input style={input} value={angle} onChange={e => setAngle(e.target.value)}
              placeholder="e.g. focus on the first 30 days with a new client" />
          </div>
        </details>
      </section>

      {/* ── EDITOR ──────────────────────────────────────────────────────── */}
      {draft && (
        <section style={{ background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 14, padding: 22, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 750, margin: 0 }}>
              {draft.id ? '✏️ Edit post' : '📝 Review draft'}{' '}
              <span style={{ fontSize: 12, color: statusMeta(draft.status).color, fontWeight: 600 }}>
                · {statusMeta(draft.status).label}
              </span>
            </h2>
            <button onClick={() => setDraft(null)} style={{ background: 'none', border: 0, color: C.textDim, cursor: 'pointer', fontSize: 13 }}>Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Title</label>
              <input style={input} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <label style={labelSt}>Emoji</label>
              <input style={{ ...input, textAlign: 'center' }} value={draft.cover_emoji} onChange={e => setDraft({ ...draft, cover_emoji: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Slug {draft.slug && <span style={{ textTransform: 'none', color: C.textDim }}>· /blog/{draft.slug}</span>}</label>
            <input style={input} value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} placeholder="auto-generated from title if blank" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Meta description <span style={{ textTransform: 'none', color: draft.meta_description.length > 155 ? C.red : C.textDim }}>· {draft.meta_description.length}/155</span></label>
            <input style={input} value={draft.meta_description} onChange={e => setDraft({ ...draft, meta_description: e.target.value })} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Excerpt (blog card teaser)</label>
            <input style={input} value={draft.excerpt} onChange={e => setDraft({ ...draft, excerpt: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Cluster</label>
              <select style={input} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                {CONTENT_CLUSTERS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Tags (comma-separated)</label>
              <input style={input} value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} />
            </div>
          </div>

          <label style={labelSt}>Body (markdown)</label>
          <textarea style={{ ...input, minHeight: 340, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
            value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => save('draft')} disabled={saving} style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Save draft
            </button>
            {draft.status !== 'published' && (
              <button onClick={() => save('ready')} disabled={saving} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                Approve to queue
              </button>
            )}
            <button onClick={() => save('published')} disabled={saving} style={{ background: C.green, color: '#0c1f14', border: 0, borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              {draft.status === 'published' ? 'Update live post' : 'Publish now'}
            </button>
            {draft.status === 'published' && draft.slug && (
              <a href={`/blog/${draft.slug}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', alignSelf: 'center', color: C.accent, fontSize: 13, fontWeight: 700 }}>
                View live ↗
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── AUTO-PILOT + DRIP QUEUE ─────────────────────────────────────── */}
      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 750, margin: '0 0 4px' }}>🚀 Auto-pilot</h2>
        <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 16px' }}>
          The engine keeps your draft buffer stocked. You approve the good ones into the queue. Approved articles publish automatically on your schedule. Nothing goes live without your approval.
        </p>

        {settings ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <button onClick={() => updateSettings({ auto_generate: !settings.auto_generate })} style={{
                width: 46, height: 26, borderRadius: 20, border: 0, cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: settings.auto_generate ? C.green : C.surface2, transition: '.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: settings.auto_generate ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 650 }}>Auto-generate drafts {settings.auto_generate ? 'on' : 'off'}</span>
              {savingSettings && <span style={{ fontSize: 12, color: C.textDim }}>saving…</span>}
            </div>

            <label style={labelSt}>Publish days</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
              {DAY_LABELS.map((d, i) => {
                const on = settings.publish_days.includes(i)
                return (
                  <button key={i} onClick={() => toggleDay(i)} style={{
                    background: on ? C.accentDim : C.bg, border: `1px solid ${on ? C.accentBorder : C.border}`,
                    color: on ? C.accent : C.textMid, borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }}>
                    {d}
                  </button>
                )
              })}
            </div>

            <label style={labelSt}>Draft buffer target</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="number" min={1} max={20} value={settings.queue_target}
                onChange={e => updateSettings({ queue_target: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                style={{ ...input, width: 90 }} />
              <span style={{ fontSize: 12.5, color: C.textDim }}>drafts kept waiting for your review</span>
            </div>
          </>
        ) : <p style={{ color: C.textDim, fontSize: 13 }}>Loading settings…</p>}

        {/* Drip queue */}
        <div style={{ marginTop: 22, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.textMid, margin: '0 0 10px' }}>
            📬 Drip queue ({readyPosts.length})
            {settings && <span style={{ color: C.textDim, fontWeight: 500 }}>
              {' '}· goes out on {settings.publish_days.length ? settings.publish_days.slice().sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(' & ') : 'no day set'}
            </span>}
          </h3>
          {readyPosts.length === 0 ? (
            <p style={{ color: C.textDim, fontSize: 13 }}>Nothing queued. Approve a draft below to line it up.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {readyPosts.map((p, idx) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.textDim, width: 20 }}>{idx + 1}.</span>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cover_emoji} {p.title}</span>
                  <button onClick={() => setPostStatus(p, 'draft')} style={{ background: 'none', border: 0, color: C.textDim, cursor: 'pointer', fontSize: 12 }}>unqueue</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── POSTS LIST ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: C.textMid }}>
          All posts ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <p style={{ color: C.textDim, fontSize: 14 }}>No posts yet. Generate your first one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <span style={{ fontSize: 22 }}>{p.cover_emoji ?? '📝'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
                    {clusterLabel(p.category)} · updated {fmtDate(p.updated_at)}
                  </div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.05em',
                  background: statusMeta(p.status).bg, color: statusMeta(p.status).color }}>
                  {statusMeta(p.status).label}
                </span>
                {p.status === 'draft' && (
                  <button onClick={() => setPostStatus(p, 'ready')} style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6', borderRadius: 7, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                )}
                <button onClick={() => edit(p)} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 7, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => del(p.id)} style={{ background: 'none', border: 0, color: C.textDim, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── COMING NEXT (TODO #6 vision) ────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${C.border}`, paddingTop: 22 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 14px' }}>Coming next in the Marketing Hub</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {[
            { e: '🎯', t: 'Lead Investigation', d: 'Find PT clinics, studios, and gyms by industry and location. Score and export leads.' },
            { e: '✉️', t: 'AI Outreach', d: 'Personalized emails, DMs, and cold-call scripts. Deliverability-aware sending.' },
            { e: '📣', t: 'Ads Management', d: 'Google, Meta, Instagram, and TikTok campaigns from one console.' },
          ].map(x => (
            <div key={x.t} style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 16, opacity: 0.8 }}>
              <div style={{ fontSize: 22 }}>{x.e}</div>
              <div style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px' }}>{x.t}</div>
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.45 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
