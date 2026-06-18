'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TAB_CATALOG, GRANTABLE_TABS, TAB_LABEL } from '@/lib/admin-tabs'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Candidate = { id: string; name: string | null; email: string | null; role: string | null }
type Partner = {
  user_id: string; name: string | null; email: string | null; role: string | null
  allowed_tabs: string[]; active: boolean; note: string | null; created_at: string; updated_at: string
}

// Grantable sections grouped for the checkbox grid.
const GRANT_GROUPS: { group: string; tabs: { id: string; label: string }[] }[] = (() => {
  const order: string[] = []
  const byGroup: Record<string, { id: string; label: string }[]> = {}
  for (const t of TAB_CATALOG) {
    if (!t.grantable) continue
    if (!byGroup[t.group]) { byGroup[t.group] = []; order.push(t.group) }
    byGroup[t.group].push({ id: t.id, label: t.label })
  }
  return order.map(group => ({ group, tabs: byGroup[group] }))
})()
const PRIVATE_LIST = TAB_CATALOG.filter(t => !t.grantable)

async function authFetch(input: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init?.headers ?? {}) },
  })
}

const labelName = (p: { name: string | null; email: string | null }) => p.name || p.email || 'Unknown user'

// ─── Section checkbox grid (shared by grant modal + partner editor) ───────────
function SectionGrid({ selected, onToggle }: { selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {GRANT_GROUPS.map(g => (
        <div key={g.group}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>{g.group}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {g.tabs.map(t => {
              const on = selected.has(t.id)
              return (
                <button key={t.id} onClick={() => onToggle(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 8, border: `1px solid ${on ? C.accentBorder : C.border}`, background: on ? C.accentDim : 'transparent', color: on ? C.text : C.textMid, fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${on ? C.accent : C.border}`, background: on ? C.accent : 'transparent', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Grant modal (pick a user + sections) ─────────────────────────────────────
function GrantModal({ candidates, onGrant, onClose }: {
  candidates: Candidate[]
  onGrant: (userId: string, tabs: string[], note: string) => Promise<void>
  onClose: () => void
}) {
  const [userId, setUserId] = useState('')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Give a Partner Access</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Person <span style={{ color: C.red }}>*</span></label>
        {candidates.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textDim, padding: '10px 0', lineHeight: 1.5 }}>No eligible users yet. A partner needs to sign up for an Atlas Prime account first — then they'll appear here.</p>
        ) : (
          <select value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' }}>
            <option value="">Select a user…</option>
            {candidates.map(c => <option key={c.id} value={c.id}>{labelName(c)}{c.email && c.name ? ` · ${c.email}` : ''}</option>)}
          </select>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Label <span style={{ fontWeight: 400 }}>(optional — e.g. "Content partner")</span></label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="What this person helps with" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 18, fontFamily: 'inherit' }} />

        <p style={{ fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 12 }}>Sections to grant ({selected.size} selected)</p>
        <SectionGrid selected={selected} onToggle={toggle} />

        <button
          onClick={async () => { if (!userId || saving) return; setSaving(true); await onGrant(userId, Array.from(selected), note); setSaving(false) }}
          disabled={!userId || saving}
          style={{ marginTop: 22, width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: userId && !saving ? C.accent : C.surface2, color: userId && !saving ? '#fff' : C.textDim, fontSize: 14, fontWeight: 700, cursor: userId && !saving ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
        >
          {saving ? 'Granting…' : 'Grant Access'}
        </button>
      </div>
    </div>
  )
}

// ─── Partner row (inline section editor) ──────────────────────────────────────
function PartnerCard({ partner, onSave, onToggleActive, onRevoke }: {
  partner: Partner
  onSave: (userId: string, tabs: string[]) => Promise<void>
  onToggleActive: (partner: Partner) => Promise<void>
  onRevoke: (partner: Partner) => void
}) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(partner.allowed_tabs))
  const [saving, setSaving] = useState(false)
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const grantedLabels = partner.allowed_tabs.filter(t => GRANTABLE_TABS.includes(t)).map(t => TAB_LABEL[t] ?? t)

  return (
    <div style={{ border: `1px solid ${partner.active ? C.border : 'rgba(245,158,11,0.3)'}`, borderRadius: 12, background: C.surface, padding: '16px 18px', opacity: partner.active ? 1 : 0.75 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{labelName(partner)}</p>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, background: partner.active ? C.greenDim : C.amberDim, color: partner.active ? C.green : C.amber }}>{partner.active ? 'Active' : 'Suspended'}</span>
          </div>
          {partner.email && partner.name && <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', marginTop: 2 }}>{partner.email}</p>}
          {partner.note && <p style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>{partner.note}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onToggleActive(partner)} style={{ padding: '6px 11px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{partner.active ? 'Suspend' : 'Reactivate'}</button>
          <button onClick={() => onRevoke(partner)} style={{ padding: '6px 11px', borderRadius: 7, border: `1px solid rgba(239,68,68,0.25)`, background: 'transparent', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Revoke</button>
        </div>
      </div>

      {!editing ? (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {grantedLabels.length === 0
            ? <span style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>No sections granted yet</span>
            : grantedLabels.map(l => <span key={l} style={{ fontSize: 11, color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: '2px 9px' }}>{l}</span>)}
          <button onClick={() => { setSelected(new Set(partner.allowed_tabs)); setEditing(true) }} style={{ fontSize: 11, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Edit sections</button>
        </div>
      ) : (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <SectionGrid selected={selected} onToggle={toggle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={async () => { setSaving(true); await onSave(partner.user_id, Array.from(selected)); setSaving(false); setEditing(false) }} disabled={saving} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save sections'}</button>
            <button onClick={() => setEditing(false)} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function AccessControlTab() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [showGrant, setShowGrant] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<Partner | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/admin/access')
      const data = await res.json()
      if (res.ok) { setPartners(data.partners ?? []); setCandidates(data.candidates ?? []) }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function grant(userId: string, tabs: string[], note: string) {
    await authFetch('/api/admin/access', { method: 'POST', body: JSON.stringify({ userId, allowed_tabs: tabs, note }) })
    setShowGrant(false)
    await load()
  }
  async function saveTabs(userId: string, tabs: string[]) {
    await authFetch('/api/admin/access', { method: 'PATCH', body: JSON.stringify({ userId, allowed_tabs: tabs }) })
    await load()
  }
  async function toggleActive(partner: Partner) {
    await authFetch('/api/admin/access', { method: 'PATCH', body: JSON.stringify({ userId: partner.user_id, active: !partner.active }) })
    await load()
  }
  async function revoke(partner: Partner) {
    await authFetch('/api/admin/access', { method: 'DELETE', body: JSON.stringify({ userId: partner.user_id }) })
    setConfirmRevoke(null)
    await load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Owner Only</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginBottom: 4 }}>Access Control</h2>
          <p style={{ fontSize: 13, color: C.textDim, maxWidth: 640, lineHeight: 1.5 }}>Give trusted partners access to specific sections of the admin portal — and take it away anytime. Your private sections (below) are never shared.</p>
        </div>
        <button onClick={() => setShowGrant(true)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>+ Give Access</button>
      </div>

      {/* Partners */}
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 12 }}>Partners ({partners.length})</p>
        {loading ? (
          <p style={{ fontSize: 13, color: C.textDim, padding: '24px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading…</p>
        ) : partners.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', border: `1px dashed ${C.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 14, color: C.textMid, marginBottom: 4 }}>No partners yet.</p>
            <p style={{ fontSize: 12, color: C.textDim }}>You're the only one with admin access. Use “Give Access” to add a partner.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {partners.map(p => <PartnerCard key={p.user_id} partner={p} onSave={saveTabs} onToggleActive={toggleActive} onRevoke={setConfirmRevoke} />)}
          </div>
        )}
      </div>

      {/* Private sections */}
      <div style={{ marginTop: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>🔒 Private to you (never grantable)</p>
        <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12, lineHeight: 1.5 }}>These sections hold user data, money, or platform controls — partners can never see them, even if you check everything else.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRIVATE_LIST.map(t => (
            <span key={t.id} style={{ fontSize: 11, color: C.textDim, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px' }}>{t.label}</span>
          ))}
        </div>
      </div>

      {showGrant && <GrantModal candidates={candidates} onGrant={grant} onClose={() => setShowGrant(false)} />}

      {confirmRevoke && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmRevoke(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <p style={{ fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 12 }}>Revoke access?</p>
            <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 20 }}>{labelName(confirmRevoke)} will immediately lose all admin portal access. You can grant it again later.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmRevoke(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'none', color: C.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => revoke(confirmRevoke)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
