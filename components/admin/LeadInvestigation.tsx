'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { LEAD_INDUSTRIES, LEAD_STATUSES, industryLabel, typeMeta, type LeadScope } from '@/lib/lead-constants'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#FF5C35', accentDim: 'rgba(255,92,53,0.12)', accentBorder: 'rgba(255,92,53,0.35)',
  green: '#22c55e', blue: '#3b82f6', amber: '#f59e0b', red: '#ef4444',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Lead = {
  id: string; business_name: string; category: string | null; business_type: string | null
  lead_score: number; score_reasons: string[]; city: string | null; region: string | null; country: string | null
  phone: string | null; website: string | null; email: string | null; owner_name: string | null
  rating: number | null; review_count: number | null; location_count: number | null
  status: string; notes: string | null; search_label: string | null
}

type Outreach = { email_subject: string; email_body: string; dm_message: string; sms_message: string; call_script: string; tone?: string }

async function authFetch(input: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(input, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init?.headers ?? {}) } })
}

function scoreColor(s: number) { return s >= 70 ? C.green : s >= 45 ? C.amber : C.textDim }

function toCsv(leads: Lead[]): string {
  const cols = ['business_name', 'business_type', 'lead_score', 'category', 'city', 'region', 'country', 'phone', 'website', 'email', 'owner_name', 'rating', 'review_count', 'status']
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = cols.join(',')
  const rows = leads.map(l => cols.map(c => esc((l as unknown as Record<string, unknown>)[c])).join(','))
  return [head, ...rows].join('\n')
}

export default function LeadInvestigation() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [industry, setIndustry] = useState('personal-training')
  const [location, setLocation] = useState('')
  const [scope, setScope] = useState<LeadScope>('local')
  const [limit, setLimit] = useState(20)
  const [searching, setSearching] = useState(false)
  const [fStatus, setFStatus] = useState('all')
  const [fType, setFType] = useState('all')
  const [fMinScore, setFMinScore] = useState(0)
  const [fq, setFq] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const flash = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 4500) }
  const [outreach, setOutreach] = useState<Record<string, Outreach | null>>({})
  const [genId, setGenId] = useState<string | null>(null)
  const [tone, setTone] = useState('warm')

  const load = useCallback(async () => {
    const p = new URLSearchParams()
    if (fStatus !== 'all') p.set('status', fStatus)
    if (fType !== 'all') p.set('type', fType)
    if (fMinScore > 0) p.set('minScore', String(fMinScore))
    if (fq.trim()) p.set('q', fq.trim())
    const res = await authFetch(`/api/admin/leads?${p.toString()}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok) setLeads(json.leads ?? [])
  }, [fStatus, fType, fMinScore, fq])
  useEffect(() => { load() }, [load])

  const runSearch = async () => {
    setSearching(true); setMsg(null)
    try {
      const res = await authFetch('/api/admin/leads/search', { method: 'POST', body: JSON.stringify({ industry, location, scope, limit }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { flash('err', json.error ?? 'Search failed'); return }
      flash('ok', `Found ${json.found}, added ${json.inserted} new lead${json.inserted === 1 ? '' : 's'}.${json.source === 'sample' ? ' (sample data)' : ''}`)
      load()
    } finally { setSearching(false) }
  }

  const setStatus = async (l: Lead, status: string) => {
    setLeads(prev => prev.map(x => x.id === l.id ? { ...x, status } : x))
    await authFetch('/api/admin/leads', { method: 'POST', body: JSON.stringify({ id: l.id, status }) })
  }
  const saveNotes = async (id: string, notes: string) => {
    await authFetch('/api/admin/leads', { method: 'POST', body: JSON.stringify({ id, notes }) })
    flash('ok', 'Note saved.')
  }
  const del = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    const res = await authFetch(`/api/admin/leads?id=${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(prev => prev.filter(x => x.id !== id)); flash('ok', 'Deleted.') }
  }
  const exportCsv = () => {
    if (!leads.length) { flash('err', 'No leads to export.'); return }
    const blob = new Blob([toCsv(leads)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `atlas-prime-leads-${leads.length}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const openLead = async (id: string) => {
    const willOpen = expanded !== id
    setExpanded(willOpen ? id : null)
    if (willOpen && outreach[id] === undefined) {
      const res = await authFetch(`/api/admin/leads/outreach?leadId=${id}`)
      const json = await res.json().catch(() => ({}))
      setOutreach(prev => ({ ...prev, [id]: res.ok ? json.outreach : null }))
    }
  }
  const generateOutreach = async (leadId: string) => {
    setGenId(leadId)
    try {
      const res = await authFetch('/api/admin/leads/outreach', { method: 'POST', body: JSON.stringify({ leadId, tone }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { flash('err', json.error ?? 'Generation failed'); return }
      setOutreach(prev => ({ ...prev, [leadId]: json.outreach }))
      flash('ok', 'Outreach kit ready. Copy and send.')
    } finally { setGenId(null) }
  }
  const copy = (text: string) => { navigator.clipboard?.writeText(text); flash('ok', 'Copied to clipboard.') }

  const input: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }
  const labelSt: React.CSSProperties = { fontSize: 11.5, color: C.textDim, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }

  return (
    <div>
      <div style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: '11px 14px', marginBottom: 18, fontSize: 12.5, color: C.textMid }}>
        Running on <b style={{ color: C.text }}>sample data</b> so you can see the full workflow. Connect Google Places or Apollo later and the same tool pulls real businesses, no rebuild.
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          background: msg.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${msg.kind === 'ok' ? C.green : C.red}`, color: msg.kind === 'ok' ? C.green : C.red }}>{msg.text}</div>
      )}

      {/* SEARCH */}
      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 750, margin: '0 0 14px' }}>🔎 Find businesses</h3>
        <label style={labelSt}>Industry</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {LEAD_INDUSTRIES.map(i => {
            const on = industry === i.id
            return <button key={i.id} onClick={() => setIndustry(i.id)} style={{ background: on ? C.accentDim : C.bg, border: `1px solid ${on ? C.accentBorder : C.border}`, color: on ? C.accent : C.textMid, borderRadius: 20, padding: '7px 13px', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>{i.emoji} {i.label}</button>
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={labelSt}>Location</label>
            <input style={{ ...input, width: '100%' }} value={location} onChange={e => setLocation(e.target.value)} placeholder='e.g. "Austin, TX" — or leave blank for worldwide' />
          </div>
          <div>
            <label style={labelSt}>Scope</label>
            <select style={input} value={scope} onChange={e => setScope(e.target.value as LeadScope)}>
              <option value="local">Local</option><option value="national">National</option><option value="worldwide">Worldwide</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>How many</label>
            <input type="number" min={1} max={40} style={{ ...input, width: 80 }} value={limit} onChange={e => setLimit(Math.max(1, Math.min(40, Number(e.target.value) || 20)))} />
          </div>
          <button onClick={runSearch} disabled={searching} style={{ background: C.accent, color: '#0c0c0f', border: 0, borderRadius: 9, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: searching ? 'wait' : 'pointer', opacity: searching ? 0.7 : 1 }}>
            {searching ? 'Searching…' : 'Find leads'}
          </button>
        </div>
      </section>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select style={input} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {LEAD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select style={input} value={fType} onChange={e => setFType(e.target.value)}>
          <option value="all">All types</option>
          <option value="independent">Independent</option><option value="multi_location">Multi-location</option><option value="enterprise">Enterprise</option>
        </select>
        <select style={input} value={fMinScore} onChange={e => setFMinScore(Number(e.target.value))}>
          <option value={0}>Any score</option><option value={45}>45+</option><option value={60}>60+</option><option value={70}>70+ (hot)</option>
        </select>
        <input style={{ ...input, flex: '1 1 160px' }} value={fq} onChange={e => setFq(e.target.value)} placeholder="Search name…" />
        <span style={{ color: C.textDim, fontSize: 13, marginLeft: 'auto' }}>{leads.length} leads</span>
        <button onClick={exportCsv} style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ Export CSV</button>
      </div>

      {/* TABLE */}
      {leads.length === 0 ? (
        <p style={{ color: C.textDim, fontSize: 14, padding: '30px 0', textAlign: 'center' }}>No leads yet. Run a search above to build your list.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {leads.map(l => {
            const t = typeMeta(l.business_type)
            const open = expanded === l.id
            const o = outreach[l.id]
            return (
              <div key={l.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
                  <div style={{ width: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 850, color: scoreColor(l.lead_score) }}>{l.lead_score}</div>
                    <div style={{ fontSize: 8.5, color: C.textDim, textTransform: 'uppercase', letterSpacing: '.06em' }}>score</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.business_name}</div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
                      <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span> · {[l.city, l.region].filter(Boolean).join(', ') || l.country} · {industryLabel(l.category)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid, textAlign: 'right', minWidth: 0 }}>
                    {l.phone && <div>{l.phone}</div>}
                    {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>website ↗</a>}
                  </div>
                  <select value={l.status} onChange={e => setStatus(l, e.target.value)} style={{ ...input, padding: '6px 8px', fontSize: 12 }}>
                    {LEAD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={() => openLead(l.id)} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>{open ? '▲' : '▼'}</button>
                  <button onClick={() => del(l.id)} style={{ background: 'none', border: 0, color: C.textDim, cursor: 'pointer', fontSize: 15 }}>✕</button>
                </div>
                {open && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px', background: C.bg, fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 12 }}>
                      <Field label="Owner / contact" value={l.owner_name} />
                      <Field label="Email" value={l.email} isEmail />
                      <Field label="Rating" value={l.rating != null ? `${l.rating} (${l.review_count ?? 0} reviews)` : null} />
                      <Field label="Locations" value={l.location_count != null ? String(l.location_count) : null} />
                    </div>
                    {l.score_reasons?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ ...labelSt }}>Why this score</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {l.score_reasons.map((r, i) => <span key={i} style={{ fontSize: 11.5, color: C.textMid, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px' }}>{r}</span>)}
                        </div>
                      </div>
                    )}
                    <div style={{ ...labelSt }}>Notes</div>
                    <textarea defaultValue={l.notes ?? ''} onBlur={e => saveNotes(l.id, e.target.value)} placeholder="Add a note (saves when you click away)…"
                      style={{ ...input, width: '100%', minHeight: 60, resize: 'vertical', fontSize: 13 }} />
                    {!l.email && <p style={{ fontSize: 11.5, color: C.textDim, marginTop: 8 }}>No contact email yet. Owner + email enrichment (Hunter / Apollo) plugs in as a Phase 2b follow-up.</p>}

                    <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ ...labelSt, margin: 0 }}>✍️ Outreach kit</div>
                        <select value={tone} onChange={e => setTone(e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12 }}>
                          <option value="warm">Warm</option><option value="direct">Direct</option><option value="problem">Problem-first</option>
                        </select>
                        <button onClick={() => generateOutreach(l.id)} disabled={genId === l.id} style={{ background: C.accent, color: '#0c0c0f', border: 0, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 800, cursor: genId === l.id ? 'wait' : 'pointer', opacity: genId === l.id ? 0.7 : 1 }}>
                          {genId === l.id ? 'Writing…' : o ? 'Regenerate' : 'Draft outreach'}
                        </button>
                      </div>
                      {o && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                          <OutreachItem label="Email" subject={o.email_subject} body={o.email_body} onCopy={copy} />
                          <OutreachItem label="Social DM" body={o.dm_message} onCopy={copy} />
                          <OutreachItem label="SMS" body={o.sms_message} onCopy={copy} />
                          <OutreachItem label="Cold-call script" body={o.call_script} onCopy={copy} />
                        </div>
                      )}
                    </div>
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

function OutreachItem({ label, subject, body, onCopy }: { label: string; subject?: string; body: string; onCopy: (t: string) => void }) {
  if (!body) return null
  const full = subject ? `Subject: ${subject}\n\n${body}` : body
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        <button onClick={() => onCopy(full)} style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Copy</button>
      </div>
      {subject && <div style={{ fontSize: 12.5, fontWeight: 650, marginBottom: 4 }}>{subject}</div>}
      <div style={{ fontSize: 12.5, color: C.textMid, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}

function Field({ label, value, isEmail }: { label: string; value: string | null; isEmail?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: C.textDim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{label}</div>
      {value ? (isEmail ? <a href={`mailto:${value}`} style={{ color: C.blue, fontSize: 13 }}>{value}</a> : <span style={{ fontSize: 13, color: C.text }}>{value}</span>)
        : <span style={{ fontSize: 13, color: C.textDim }}>—</span>}
    </div>
  )
}
