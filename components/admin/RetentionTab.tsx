'use client'
import { useMemo, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444',
  purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type UserStat = {
  id: string
  name: string | null
  role: string
  is_admin: boolean
  updated_at: string
  hasProgram: boolean
  programId: string | null
  weeksGenerated: number
  daysCompleted: number
  exerciseLogs: number
  lastActive: string | null
}

type Segment = 'active' | 'at_risk' | 'churned' | 'plan_no_log' | 'no_plan'

const SEGMENTS: { id: Segment; label: string; desc: string; color: string }[] = [
  { id: 'active',      label: 'Active',                 desc: 'Worked out in last 7 days',           color: C.green  },
  { id: 'at_risk',     label: 'At Risk',                desc: 'Last activity 8–21 days ago',         color: C.amber  },
  { id: 'churned',     label: 'Churned',                desc: 'No activity in 22+ days',             color: C.red    },
  { id: 'plan_no_log', label: 'Plan — Never Logged',    desc: 'Generated plan, zero workouts logged', color: C.purple },
  { id: 'no_plan',     label: 'No Plan Yet',            desc: 'Joined but never built a plan',       color: C.textDim },
]

function classify(u: UserStat): Segment {
  if (!u.hasProgram) return 'no_plan'
  if (u.daysCompleted === 0 && u.exerciseLogs === 0) return 'plan_no_log'
  if (!u.lastActive) return 'churned'
  const daysAgo = (Date.now() - new Date(u.lastActive).getTime()) / 86400000
  if (daysAgo <= 7) return 'active'
  if (daysAgo <= 21) return 'at_risk'
  return 'churned'
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

function exportSegmentCSV(users: UserStat[], segId: Segment) {
  function esc(v: string | null) {
    if (!v) return ''
    const s = v.replace(/"/g, '""')
    return /[,"\n\r]/.test(s) ? `"${s}"` : s
  }
  const header = 'Name,User ID,Tier,Last Active,Days Done,Logs\n'
  const body = users.map(u => [
    esc(u.name ?? 'Unknown'),
    esc(u.id),
    esc(u.role),
    esc(u.lastActive ? fmtRelative(u.lastActive) : 'Never'),
    String(u.daysCompleted),
    String(u.exerciseLogs),
  ].join(',')).join('\n')
  const blob = new Blob(['﻿' + header + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${segId}_users.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function RetentionTab({ users }: { users: UserStat[] }) {
  const [selected, setSelected] = useState<Segment | null>(null)
  const [tokenSpend, setTokenSpend] = useState<Record<string, number>>({})

  useEffect(() => {
    supabase.from('token_usage')
      .select('user_id, input_tokens, output_tokens')
      .not('user_id', 'is', null)
      .then(({ data }) => {
        const agg: Record<string, number> = {}
        for (const r of (data ?? [])) {
          if (!r.user_id) continue
          agg[r.user_id] = (agg[r.user_id] ?? 0) + ((r.input_tokens ?? 0) * 3 + (r.output_tokens ?? 0) * 15) / 1_000_000
        }
        setTokenSpend(agg)
      })
  }, [])

  const totalApiSpend = Object.values(tokenSpend).reduce((s, v) => s + v, 0)
  const usersWithSpend = Object.keys(tokenSpend).length
  const avgCostPerUser = usersWithSpend > 0 ? totalApiSpend / usersWithSpend : 0

  const groups = useMemo(() => {
    const g: Record<Segment, UserStat[]> = { active: [], at_risk: [], churned: [], plan_no_log: [], no_plan: [] }
    users.forEach(u => g[classify(u)].push(u))
    return g
  }, [users])

  const list = selected ? groups[selected] : []
  const segCfg = selected ? SEGMENTS.find(s => s.id === selected) : null

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Retention Dashboard</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>User engagement segments — click any card to drill in</p>
      </div>

      {/* API Cost KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Total API Spend', value: `$${totalApiSpend.toFixed(4)}`, color: C.amber },
          { label: 'Avg Cost / User', value: `$${avgCostPerUser.toFixed(4)}`, color: C.purple },
          { label: 'Users w/ API Activity', value: usersWithSpend, color: C.accent },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{k.value}</p>
            <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 4 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Segment cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 28 }}>
        {SEGMENTS.map(seg => {
          const count = groups[seg.id].length
          const isActive = selected === seg.id
          return (
            <div
              key={seg.id}
              onClick={() => setSelected(isActive ? null : seg.id)}
              style={{
                padding: '18px 20px',
                background: isActive ? `${seg.color}10` : C.surface,
                border: `1px solid ${isActive ? seg.color : C.border}`,
                borderTop: `3px solid ${seg.color}`,
                borderRadius: 10,
                cursor: 'pointer',
                boxShadow: isActive ? `0 0 20px ${seg.color}18` : 'none',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 800, color: seg.color, letterSpacing: '-0.04em', marginBottom: 4, textShadow: `0 0 20px ${seg.color}50` }}>{count}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{seg.label}</div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>{seg.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Drill-down */}
      {selected && segCfg && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: segCfg.color }}>{segCfg.label}</span>
              <span style={{ fontSize: 13, color: C.textDim, marginLeft: 8 }}>· {list.length} user{list.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => exportSegmentCSV(list, selected)}
                disabled={list.length === 0}
                style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: list.length > 0 ? C.textMid : C.textDim, fontSize: 12, cursor: list.length > 0 ? 'pointer' : 'not-allowed' }}
              >
                Export CSV
              </button>
              <button
                onClick={() => setSelected(null)}
                style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>

          {list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: C.textDim, fontSize: 13, border: `2px dashed ${C.border}`, borderRadius: 10 }}>
              No users in this segment — great news for Churned!
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 110px 90px 70px', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                {['User', 'Tier', 'Last Active', 'Days Done', 'Logs'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{h}</span>
                ))}
              </div>
              {list.map((u, i) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 110px 90px 70px', padding: '12px 20px', borderBottom: i < list.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.name ?? 'Unknown'}</div>
                    <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{u.id.slice(0, 14)}…</div>
                  </div>
                  <span style={{ fontSize: 11, color: C.textMid, fontFamily: 'monospace', textTransform: 'uppercase' }}>{u.role}</span>
                  <span style={{ fontSize: 11, color: u.lastActive ? C.textMid : C.textDim, fontFamily: 'monospace' }}>{u.lastActive ? fmtRelative(u.lastActive) : '—'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: u.daysCompleted > 0 ? C.green : C.textDim, fontFamily: 'monospace' }}>{u.daysCompleted || '—'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: u.exerciseLogs > 0 ? C.purple : C.textDim, fontFamily: 'monospace' }}>{u.exerciseLogs || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
