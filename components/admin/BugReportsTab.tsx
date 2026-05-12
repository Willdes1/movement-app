'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', redDim: 'rgba(239,68,68,0.1)',
  orange: '#f97316', orangeDim: 'rgba(249,115,22,0.1)',
  purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type BugStatus   = 'new' | 'in_review' | 'fixed' | 'wont_fix'
type Priority    = 'critical' | 'high' | 'medium' | 'low'
type Severity    = 'annoying' | 'blocks_me' | 'broken'
type FilterTab   = 'all' | BugStatus

interface BugReport {
  id: string
  user_id: string | null
  user_email: string | null
  user_role: string | null
  page_url: string | null
  feature_label: string | null
  description: string
  severity: Severity
  priority: Priority
  status: BugStatus
  admin_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: C.red,    bg: C.redDim },
  high:     { label: 'High',     color: C.orange,  bg: C.orangeDim },
  medium:   { label: 'Medium',   color: C.amber,   bg: C.amberDim },
  low:      { label: 'Low',      color: C.textDim, bg: 'rgba(110,118,129,0.1)' },
}

const SEVERITY_CFG: Record<Severity, { label: string; color: string }> = {
  broken:    { label: '🔥 Broken',   color: C.red },
  blocks_me: { label: '🚧 Blocks Me', color: C.orange },
  annoying:  { label: '😤 Annoying', color: C.amber },
}

const STATUS_CFG: Record<BugStatus, { label: string; color: string; bg: string }> = {
  new:       { label: 'New',        color: C.accent,  bg: C.accentDim },
  in_review: { label: 'In Review',  color: C.purple,  bg: 'rgba(167,139,250,0.1)' },
  fixed:     { label: 'Fixed',      color: C.green,   bg: C.greenDim },
  wont_fix:  { label: "Won't Fix",  color: C.textDim, bg: 'rgba(110,118,129,0.08)' },
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function Badge({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 5, background: bg, color,
      border: `1px solid ${color}30`, fontFamily: 'monospace', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

export default function BugReportsTab({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [reports, setReports]     = useState<BugReport[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterTab>('all')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [updating, setUpdating]   = useState<string | null>(null)
  const [notes, setNotes]         = useState<Record<string, string>>({})

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)
    const { data } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as BugReport[]
    setReports(rows)
    const initialNotes: Record<string, string> = {}
    rows.forEach(r => { if (r.admin_notes) initialNotes[r.id] = r.admin_notes })
    setNotes(initialNotes)
    const newCount = rows.filter(r => r.status === 'new').length
    onCountChange?.(newCount)
    setLoading(false)
  }

  async function updateStatus(id: string, status: BugStatus) {
    setUpdating(id)
    const resolved_at = (status === 'fixed' || status === 'wont_fix') ? new Date().toISOString() : null
    await supabase.from('bug_reports').update({ status, resolved_at, updated_at: new Date().toISOString() }).eq('id', id)
    setReports(prev => prev.map(r => r.id === id ? { ...r, status, resolved_at } : r))
    const newCount = reports.filter(r => r.id !== id ? r.status === 'new' : status === 'new').length
    onCountChange?.(newCount)
    setUpdating(null)
  }

  async function saveNotes(id: string) {
    await supabase.from('bug_reports').update({ admin_notes: notes[id] ?? '', updated_at: new Date().toISOString() }).eq('id', id)
  }

  const sorted = [...reports].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pd !== 0) return pd
    return b.created_at.localeCompare(a.created_at)
  })

  const filtered = filter === 'all' ? sorted : sorted.filter(r => r.status === filter)

  const counts: Record<FilterTab, number> = {
    all:       reports.length,
    new:       reports.filter(r => r.status === 'new').length,
    in_review: reports.filter(r => r.status === 'in_review').length,
    fixed:     reports.filter(r => r.status === 'fixed').length,
    wont_fix:  reports.filter(r => r.status === 'wont_fix').length,
  }

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',       label: `All (${counts.all})` },
    { id: 'new',       label: `New (${counts.new})` },
    { id: 'in_review', label: `In Review (${counts.in_review})` },
    { id: 'fixed',     label: `Fixed (${counts.fixed})` },
    { id: 'wont_fix',  label: `Won't Fix (${counts.wont_fix})` },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Bug Reports</h2>
          <p style={{ fontSize: 13, color: C.textDim }}>
            {loading ? 'Loading…' : `${counts.new} new · ${counts.all} total`}
          </p>
        </div>
        <button
          onClick={loadReports}
          disabled={loading}
          style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}
        >
          ↺ Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 22, borderBottom: `1px solid ${C.border}`, paddingBottom: 1 }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              padding: '7px 14px', border: 'none',
              borderBottom: filter === t.id ? `2px solid ${t.id === 'new' ? C.red : C.accent}` : '2px solid transparent',
              background: 'none',
              color: filter === t.id ? (t.id === 'new' ? C.red : C.accent) : C.textDim,
              fontSize: 12, fontWeight: filter === t.id ? 700 : 400,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.textDim }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
          <p style={{ fontSize: 14 }}>{filter === 'all' ? 'No bug reports yet.' : `No ${filter.replace('_', ' ')} reports.`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(report => {
            const isExpanded = expanded === report.id
            const pCfg = PRIORITY_CFG[report.priority]
            const sCfg = SEVERITY_CFG[report.severity]
            const stCfg = STATUS_CFG[report.status]
            const isBusy = updating === report.id

            return (
              <div
                key={report.id}
                style={{
                  borderRadius: 12, border: `1px solid ${isExpanded ? C.accentBorder : C.border}`,
                  background: C.surface, overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : report.id)}
                  style={{
                    width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Badge color={pCfg.color} bg={pCfg.bg} label={pCfg.label} />
                    <Badge color={sCfg.color} bg={`${sCfg.color}15`} label={sCfg.label} />
                    <Badge color={stCfg.color} bg={stCfg.bg} label={stCfg.label} />
                    {report.user_role && (
                      <Badge
                        color={report.user_role === 'coach' ? C.purple : C.textDim}
                        bg={report.user_role === 'coach' ? 'rgba(167,139,250,0.1)' : 'rgba(110,118,129,0.08)'}
                        label={report.user_role}
                      />
                    )}
                    <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{fmtRelative(report.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ fontSize: 13, color: C.textMid, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                      {report.description}
                    </p>
                    <span style={{ color: C.textDim, fontSize: 12, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {(report.feature_label || report.page_url) && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      {report.feature_label && <span style={{ fontSize: 11, color: C.textDim }}>📍 {report.feature_label}</span>}
                      {report.page_url && <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{report.page_url}</span>}
                    </div>
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}`, marginTop: 0 }}>
                    {/* Reporter */}
                    <div style={{ padding: '12px 0 14px', display: 'flex', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Reporter</p>
                        <p style={{ fontSize: 13, color: C.textMid }}>{report.user_email ?? 'Anonymous'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Submitted</p>
                        <p style={{ fontSize: 13, color: C.textMid }}>{new Date(report.created_at).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Full description */}
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: C.surface2, border: `1px solid ${C.border}`, marginBottom: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Description</p>
                      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{report.description}</p>
                    </div>

                    {/* Admin notes */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Admin Notes (internal)</label>
                      <textarea
                        value={notes[report.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                        placeholder="Add notes, root cause, fix reference…"
                        rows={2}
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: 8,
                          border: `1px solid ${C.border}`, background: C.bg,
                          color: C.text, fontSize: 12, fontFamily: 'inherit',
                          resize: 'vertical', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box',
                        }}
                        onFocus={e => e.target.style.borderColor = C.accentBorder}
                        onBlur={e => { e.target.style.borderColor = C.border; saveNotes(report.id) }}
                      />
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {report.status === 'new' && (
                        <button
                          onClick={() => updateStatus(report.id, 'in_review')}
                          disabled={isBusy}
                          style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'rgba(167,139,250,0.08)', color: C.purple, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {isBusy ? '…' : '◐ In Review'}
                        </button>
                      )}
                      {(report.status === 'new' || report.status === 'in_review') && (
                        <button
                          onClick={() => updateStatus(report.id, 'fixed')}
                          disabled={isBusy}
                          style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid rgba(34,197,94,0.3)`, background: C.greenDim, color: C.green, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {isBusy ? '…' : '✓ Mark Fixed'}
                        </button>
                      )}
                      {(report.status === 'new' || report.status === 'in_review') && (
                        <button
                          onClick={() => updateStatus(report.id, 'wont_fix')}
                          disabled={isBusy}
                          style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {isBusy ? '…' : "— Won't Fix"}
                        </button>
                      )}
                      {(report.status === 'fixed' || report.status === 'wont_fix') && (
                        <button
                          onClick={() => updateStatus(report.id, 'new')}
                          disabled={isBusy}
                          style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          ↩ Reopen
                        </button>
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
