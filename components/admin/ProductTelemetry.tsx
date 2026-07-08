'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)',
  green: '#22c55e', amber: '#f59e0b', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Tally = { key: string; count: number }
type ProductData = {
  pendingMigration?: boolean
  total: number
  uniqueUsers: number
  pageViewsToday: number
  byEvent: Tally[]
  byPath: Tally[]
  byRole: Tally[]
  daily: { day: string; count: number }[]
  recent: { event_name: string; path: string | null; role: string | null; created_at: string }[]
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ProductTelemetry() {
  const [data, setData]       = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/product-events', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const d = await res.json().catch(() => null)
      if (!res.ok) setErr(d?.error || 'Failed to load product telemetry.')
      else setData(d as ProductData)
    } catch { setErr('Failed to load product telemetry.') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p style={{ fontSize: 13, color: C.textDim, padding: '40px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading product telemetry…</p>
  if (err) return <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 13, color: '#ef4444' }}>{err}</div>

  if (data?.pendingMigration) {
    return (
      <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 13, color: C.amber }}>
        ⚠ The <code style={{ fontFamily: 'monospace' }}>product_events</code> table doesn&apos;t exist yet. Run{' '}
        <code style={{ fontFamily: 'monospace' }}>supabase/migrations/20260708_product_events.sql</code>, then Refresh. Page views are being sent already — they&apos;ll start recording once the table exists.
      </div>
    )
  }
  if (!data) return null

  const maxDay = Math.max(1, ...data.daily.map(d => d.count))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={load} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Events (30d)', value: data.total.toLocaleString(), color: C.text },
          { label: 'Unique users (30d)', value: data.uniqueUsers.toLocaleString(), color: C.purple },
          { label: 'Page views today', value: data.pageViewsToday.toLocaleString(), color: C.accent },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</p>
            <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 4 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* 7-day activity bars */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Events · last 7 days</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
          {data.daily.map(d => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{d.count}</span>
              <div title={`${d.day}: ${d.count}`} style={{ width: '100%', height: `${Math.round((d.count / maxDay) * 60)}px`, minHeight: 2, background: C.accent, borderRadius: 4, opacity: 0.85 }} />
              <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: top pages + top events */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        <TallyCard title="Top pages (click-through)" rows={data.byPath} color={C.accent} empty="No page views yet." />
        <TallyCard title="Top events" rows={data.byEvent} color={C.purple} empty="No events yet." />
      </div>

      {data.byRole.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <TallyCard title="By role" rows={data.byRole} color={C.green} empty="—" />
        </div>
      )}

      {/* Recent stream */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>Recent activity</div>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {data.recent.length === 0
            ? <p style={{ padding: '20px 16px', fontSize: 12, color: C.textDim }}>No product events recorded yet. Navigate the app and refresh.</p>
            : data.recent.map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, padding: '8px 16px', borderBottom: i < data.recent.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{fmtWhen(e.created_at)}</span>
                <span style={{ fontSize: 12, color: C.textMid, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.event_name}{e.path ? <span style={{ color: C.textDim }}> · {e.path}</span> : null}
                </span>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{e.role ?? 'anon'}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function TallyCard({ title, rows, color, empty }: { title: string; rows: Tally[]; color: string; empty: string }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{title}</p>
      {rows.length === 0
        ? <p style={{ fontSize: 12, color: C.textDim }}>{empty}</p>
        : rows.map(r => (
          <div key={r.key} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 11.5, color: C.textMid, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.key}</span>
              <span style={{ fontSize: 11.5, color: C.text, fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{r.count}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: C.surface2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((r.count / max) * 100)}%`, background: color, opacity: 0.8 }} />
            </div>
          </div>
        ))}
    </div>
  )
}
