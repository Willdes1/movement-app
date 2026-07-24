'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AD_PLATFORMS, AD_PRODUCTS, AD_OBJECTIVES, platformMeta, productLabel, objectiveLabel } from '@/lib/ads-constants'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#FF5C35', accentDim: 'rgba(255,92,53,0.12)', accentBorder: 'rgba(255,92,53,0.35)',
  green: '#22c55e', blue: '#3b82f6', amber: '#f59e0b', text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Plan = {
  campaign_name?: string; big_idea?: string
  audience?: { who?: string; demographics?: string; interests?: string[]; locations?: string; lookalikes?: string }
  keywords?: string[]
  ad_variations?: { headlines?: string[]; primary_text?: string; description?: string; cta?: string }[]
  creative_ideas?: string[]; budget_bid?: string; setup_notes?: string
}
type Campaign = { id: string; name: string | null; platform: string; product: string; objective: string; daily_budget: number | null; plan: Plan; status: string; created_at: string }

async function authFetch(input: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(input, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init?.headers ?? {}) } })
}

function fmtVariation(v: NonNullable<Plan['ad_variations']>[number]): string {
  const parts: string[] = []
  if (v.headlines?.length) parts.push('Headlines:\n' + v.headlines.map(h => `- ${h}`).join('\n'))
  if (v.primary_text) parts.push('Primary text:\n' + v.primary_text)
  if (v.description) parts.push('Description:\n' + v.description)
  if (v.cta) parts.push('CTA: ' + v.cta)
  return parts.join('\n\n')
}

export default function AdsStudio() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [platform, setPlatform] = useState('google')
  const [product, setProduct] = useState('coach')
  const [objective, setObjective] = useState('signups')
  const [dailyBudget, setDailyBudget] = useState<number | ''>(20)
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const flash = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 4500) }

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/ads')
    const json = await res.json().catch(() => ({}))
    if (res.ok) setCampaigns(json.campaigns ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true); setMsg(null)
    try {
      const res = await authFetch('/api/admin/ads/generate', { method: 'POST', body: JSON.stringify({ platform, product, objective, dailyBudget: dailyBudget === '' ? null : dailyBudget, notes }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { flash('err', json.error ?? 'Generation failed'); return }
      setCampaigns(prev => [json.campaign, ...prev])
      setExpanded(json.campaign.id)
      flash('ok', 'Campaign plan ready. Copy it into the platform ads manager.')
    } finally { setGenerating(false) }
  }
  const setStatus = async (c: Campaign, status: string) => {
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status } : x))
    await authFetch('/api/admin/ads', { method: 'POST', body: JSON.stringify({ id: c.id, status }) })
  }
  const del = async (id: string) => {
    if (!confirm('Delete this campaign plan?')) return
    const res = await authFetch(`/api/admin/ads?id=${id}`, { method: 'DELETE' })
    if (res.ok) { setCampaigns(prev => prev.filter(x => x.id !== id)); flash('ok', 'Deleted.') }
  }
  const copy = (t: string) => { navigator.clipboard?.writeText(t); flash('ok', 'Copied to clipboard.') }

  const input: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }
  const labelSt: React.CSSProperties = { fontSize: 11.5, color: C.textDim, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }
  const chip = (on: boolean): React.CSSProperties => ({ background: on ? C.accentDim : C.bg, border: `1px solid ${on ? C.accentBorder : C.border}`, color: on ? C.accent : C.textMid, borderRadius: 20, padding: '7px 13px', fontSize: 13, fontWeight: 650, cursor: 'pointer' })

  return (
    <div>
      <div style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: '11px 14px', marginBottom: 18, fontSize: 12.5, color: C.textMid }}>
        These are launch-ready campaign <b style={{ color: C.text }}>plans to paste into each platform ads manager</b>. Direct API launching + ROI attribution is Phase 4b (needs approved ad accounts on each platform).
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          background: msg.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${msg.kind === 'ok' ? C.green : '#ef4444'}`, color: msg.kind === 'ok' ? C.green : '#ef4444' }}>{msg.text}</div>
      )}

      {/* BUILDER */}
      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 750, margin: '0 0 14px' }}>📣 Build a campaign</h3>

        <label style={labelSt}>Platform</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {AD_PLATFORMS.map(p => <button key={p.id} onClick={() => setPlatform(p.id)} style={chip(platform === p.id)}>{p.emoji} {p.label}</button>)}
        </div>

        <label style={labelSt}>Promoting</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {AD_PRODUCTS.map(p => <button key={p.id} onClick={() => setProduct(p.id)} style={chip(product === p.id)}>{p.label}</button>)}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Objective</label>
            <select style={input} value={objective} onChange={e => setObjective(e.target.value)}>
              {AD_OBJECTIVES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Daily budget ($)</label>
            <input type="number" min={0} style={{ ...input, width: 110 }} value={dailyBudget} onChange={e => setDailyBudget(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
          </div>
        </div>

        <label style={labelSt}>Extra direction (optional)</label>
        <input style={{ ...input, width: '100%', marginBottom: 16 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. target skateboarders, or push the free trial angle" />

        <button onClick={generate} disabled={generating} style={{ background: C.accent, color: '#0c0c0f', border: 0, borderRadius: 9, padding: '12px 22px', fontSize: 14.5, fontWeight: 800, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
          {generating ? 'Building campaign…' : '✨ Generate campaign'}
        </button>
      </section>

      {/* SAVED CAMPAIGNS */}
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: C.textMid }}>Campaigns ({campaigns.length})</h3>
      {campaigns.length === 0 ? (
        <p style={{ color: C.textDim, fontSize: 14 }}>No campaigns yet. Build your first one above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaigns.map(c => {
            const pm = platformMeta(c.platform)
            const open = expanded === c.id
            const plan = c.plan ?? {}
            return (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                  <span style={{ fontSize: 20 }}>{pm.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>{pm.label} · {productLabel(c.product)} · {objectiveLabel(c.objective)}{c.daily_budget != null ? ` · $${c.daily_budget}/day` : ''}</div>
                  </div>
                  <select value={c.status} onChange={e => setStatus(c, e.target.value)} style={{ ...input, padding: '6px 8px', fontSize: 12 }}>
                    <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
                  </select>
                  <button onClick={() => setExpanded(open ? null : c.id)} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>{open ? '▲' : '▼'}</button>
                  <button onClick={() => del(c.id)} style={{ background: 'none', border: 0, color: C.textDim, cursor: 'pointer', fontSize: 15 }}>✕</button>
                </div>

                {open && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, background: C.bg, fontSize: 13 }}>
                    {plan.big_idea && <p style={{ margin: '0 0 14px', color: C.text, fontStyle: 'italic' }}>“{plan.big_idea}”</p>}

                    {plan.audience && (
                      <Block label="Audience">
                        {plan.audience.who && <Line k="Who" v={plan.audience.who} />}
                        {plan.audience.demographics && <Line k="Demographics" v={plan.audience.demographics} />}
                        {plan.audience.interests?.length ? <Line k="Interests" v={plan.audience.interests.join(', ')} /> : null}
                        {plan.audience.locations && <Line k="Locations" v={plan.audience.locations} />}
                        {plan.audience.lookalikes && <Line k="Lookalikes" v={plan.audience.lookalikes} />}
                      </Block>
                    )}

                    {plan.keywords && plan.keywords.length > 0 && (
                      <Block label="Keywords" onCopy={() => copy(plan.keywords!.join('\n'))}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {plan.keywords.map((k, i) => <span key={i} style={{ fontSize: 12, color: C.textMid, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px' }}>{k}</span>)}
                        </div>
                      </Block>
                    )}

                    {plan.ad_variations?.map((v, i) => (
                      <Block key={i} label={`Ad variation ${i + 1}`} onCopy={() => copy(fmtVariation(v))}>
                        {v.headlines?.length ? <div style={{ marginBottom: 6 }}>{v.headlines.map((h, j) => <div key={j} style={{ fontSize: 13, fontWeight: 600 }}>• {h}</div>)}</div> : null}
                        {v.primary_text && <div style={{ color: C.textMid, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 4 }}>{v.primary_text}</div>}
                        {v.description && <div style={{ color: C.textDim, fontSize: 12.5, marginBottom: 4 }}>{v.description}</div>}
                        {v.cta && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.blue }}>CTA: {v.cta}</span>}
                      </Block>
                    ))}

                    {plan.creative_ideas && plan.creative_ideas.length > 0 && (
                      <Block label="Creative ideas">
                        <ul style={{ margin: 0, paddingLeft: 18, color: C.textMid, lineHeight: 1.6 }}>{plan.creative_ideas.map((c2, i) => <li key={i}>{c2}</li>)}</ul>
                      </Block>
                    )}

                    {plan.budget_bid && <Block label="Budget & bidding"><span style={{ color: C.textMid }}>{plan.budget_bid}</span></Block>}
                    {plan.setup_notes && <Block label="Setup notes"><span style={{ color: C.textMid, whiteSpace: 'pre-wrap' }}>{plan.setup_notes}</span></Block>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Block({ label, children, onCopy }: { label: string; children: React.ReactNode; onCopy?: () => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FF5C35', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        {onCopy && <button onClick={onCopy} style={{ background: '#21262d', border: '1px solid #30363d', color: '#b1bac4', borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Copy</button>}
      </div>
      {children}
    </div>
  )
}
function Line({ k, v }: { k: string; v: string }) {
  return <div style={{ fontSize: 13, marginBottom: 3 }}><span style={{ color: '#6e7681' }}>{k}: </span><span style={{ color: '#e6edf3' }}>{v}</span></div>
}
