'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import LaunchpadTab from '@/components/admin/LaunchpadTab'
import HealthTab from '@/components/admin/HealthTab'

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#21262d',
  border: '#30363d',
  accent: '#3b82f6',
  accentDim: 'rgba(59,130,246,0.12)',
  accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b',
  amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444',
  purple: '#a78bfa',
  text: '#e6edf3',
  textMid: '#b1bac4',
  textDim: '#6e7681',
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'users' | 'activity' | 'todos' | 'ideas' | 'promos' | 'marketing' | 'partners' | 'launchpad' | 'health'
type TodoRow = { id: string; content: string; category: string; status: string; priority: string; created_at: string; updated_at: string }
type IdeaRow = { id: string; content: string; category: string; created_at: string }
type PromoRow = { id: string; code: string; role: string; max_uses: number; uses: number; created_at: string }
type ProfileRow = { id: string; email: string; name: string | null; full_name: string | null; role: string; is_admin: boolean; created_at: string }
type UserStat = ProfileRow & { hasProgram: boolean; programId: string | null; weeksGenerated: number; daysCompleted: number; exerciseLogs: number; lastActive: string | null }
type ActivityEvent = { key: string; type: 'signup' | 'week' | 'complete' | 'log'; userName: string; detail: string; timestamp: string }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return fmtDate(iso)
}
function displayName(p: ProfileRow) {
  return p.name ?? p.full_name ?? p.email
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    admin: { bg: C.amberDim, color: C.amber },
    beta: { bg: C.greenDim, color: C.green },
    ff:   { bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
    free: { bg: 'rgba(110,118,129,0.1)', color: C.textDim },
  }
  const s = cfg[role] ?? cfg.free
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.color}30`, fontFamily: 'monospace' }}>{role}</span>
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: C.text, marginBottom: sub ? 4 : 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: C.textDim }}>{sub}</p>}
    </div>
  )
}

function TableHeader({ cols }: { cols: { label: string; width?: string | number }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols.map(c => c.width ?? '1fr').join(' '), padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
      {cols.map(c => <span key={c.label} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{c.label}</span>)}
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', ...style }}>{children}</div>
}

function EmptyState({ msg }: { msg: string }) {
  return <p style={{ fontSize: 12, color: C.textDim, padding: '32px 20px', textAlign: 'center', fontFamily: 'monospace' }}>{msg}</p>
}

function Flash({ msg }: { msg: string }) {
  if (!msg) return null
  return <div style={{ padding: '10px 14px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: 8, fontSize: 13, color: C.green, marginBottom: 16, fontFamily: 'monospace' }}>{msg}</div>
}

const inputSt: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'rgba(0,20,60,0.7)', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const addBtnSt: React.CSSProperties = { padding: '9px 16px', borderRadius: 7, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', letterSpacing: '0.04em' }
const deleteBtnSt: React.CSSProperties = { background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 13, padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ users, events, kpis, isMobile }: {
  users: UserStat[]
  events: ActivityEvent[]
  kpis: { label: string; value: string | number; sub: string; accent: string }[]
  isMobile: boolean
}) {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const ACTIVITY_COLOR: Record<string, string> = { signup: C.amber, week: C.accent, complete: C.green, log: C.purple }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{now}</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: C.text }}>Platform Overview</h2>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            padding: '20px',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            borderTop: `2px solid ${k.accent}`,
            boxShadow: `0 1px 3px rgba(0,0,0,0.2)`,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', color: k.accent, marginBottom: 4, textShadow: `0 0 20px ${k.accent}60` }}>{k.value}</p>
            <p style={{ fontSize: 11, color: String(k.sub).startsWith('↑') ? C.green : C.textDim, fontFamily: 'monospace' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Activity + Users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 12, color: C.accent, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recent Activity</p>
          </div>
          {events.length === 0 && <EmptyState msg="No activity yet" />}
          {events.slice(0, 8).map(e => (
            <div key={e.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: ACTIVITY_COLOR[e.type] ?? C.textDim, flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${ACTIVITY_COLOR[e.type] ?? C.textDim}` }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13 }}><strong style={{ fontWeight: 700, color: C.text }}>{e.userName}</strong><span style={{ color: C.textMid }}> — {e.detail}</span></p>
              </div>
              <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, fontFamily: 'monospace' }}>{fmtRelative(e.timestamp)}</span>
            </div>
          ))}
        </Panel>

        <Panel>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontWeight: 700, fontSize: 12, color: C.accent, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Users</p>
          </div>
          {users.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? C.accentDim : C.surface2, border: `1px solid ${u.role === 'admin' ? C.accentBorder : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: u.role === 'admin' ? C.accent : C.textMid, flexShrink: 0 }}>
                {displayName(u)[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{u.email}</p>
                <p style={{ fontSize: 10, color: C.textDim }}>{u.hasProgram ? `${u.weeksGenerated}w · ${u.daysCompleted} days` : 'No plan'}</p>
              </div>
              <RoleBadge role={u.role} />
            </div>
          ))}
        </Panel>
      </div>
    </>
  )
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({ users, onRoleChange, onZoomIn, onImpersonate }: { users: UserStat[]; onRoleChange: (id: string, role: string) => Promise<void>; onZoomIn: (user: UserStat) => void; onImpersonate: (id: string, name: string) => void }) {
  const betaCount = users.filter(u => u.role === 'beta').length
  const ffCount = users.filter(u => u.role === 'ff').length
  const freeCount = users.filter(u => u.role === 'free').length

  return (
    <>
      <SectionHead title="Users" sub={`${users.length} total · ${ffCount} f&f · ${betaCount} beta · ${freeCount} free`} />
      <Panel>
        <TableHeader cols={[
          { label: 'User', width: '2fr' },
          { label: 'Role', width: 90 },
          { label: 'Plan', width: 70 },
          { label: 'Weeks', width: 70 },
          { label: 'Days', width: 60 },
          { label: 'Logs', width: 60 },
          { label: 'Last Active', width: 100 },
          { label: 'Joined', width: 90 },
          { label: 'Promote', width: 110 },
          { label: '', width: 110 },
        ]} />
        {users.length === 0 && <EmptyState msg="No users yet" />}
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 70px 70px 60px 60px 100px 90px 110px 110px', padding: '13px 20px', borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', gap: 0 }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: C.text }}>{displayName(u)}</p>
              <p style={{ fontSize: 10, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220, fontFamily: 'monospace' }}>{u.email}</p>
            </div>
            <RoleBadge role={u.role} />
            <span style={{ fontSize: 11, color: u.hasProgram ? C.green : C.textDim, fontWeight: u.hasProgram ? 700 : 400, fontFamily: 'monospace' }}>{u.hasProgram ? 'Active' : '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: u.weeksGenerated > 0 ? C.accent : C.textDim, fontFamily: 'monospace' }}>{u.weeksGenerated || '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: u.daysCompleted > 0 ? C.text : C.textDim, fontFamily: 'monospace' }}>{u.daysCompleted || '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: u.exerciseLogs > 0 ? C.text : C.textDim, fontFamily: 'monospace' }}>{u.exerciseLogs || '—'}</span>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{u.lastActive ? fmtRelative(u.lastActive) : fmtDate(u.created_at)}</span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{fmtDate(u.created_at)}</span>
            {u.is_admin ? (
              <span style={{ fontSize: 10, color: C.amber, fontFamily: 'monospace' }}>Admin</span>
            ) : (
              <select value={u.role} onChange={e => onRoleChange(u.id, e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'rgba(0,15,50,0.9)', color: C.text, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', outline: 'none' }}>
                <option value="free">free</option>
                <option value="ff">f&f</option>
                <option value="beta">beta</option>
              </select>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {!u.is_admin && (
                <button
                  onClick={() => onImpersonate(u.id, displayName(u))}
                  title="View app as this user"
                  style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700 }}
                >
                  👁
                </button>
              )}
              <button onClick={() => onZoomIn(u)} title="View user details" style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700 }}>→</button>
            </div>
          </div>
        ))}
      </Panel>
    </>
  )
}

// ─── ACTIVITY TAB ─────────────────────────────────────────────────────────────
function ActivityTab({ events }: { events: ActivityEvent[] }) {
  const TYPE_COLOR: Record<string, string> = { signup: C.amber, week: C.accent, complete: C.green, log: C.purple }
  const TYPE_LABEL: Record<string, string> = { signup: 'JOIN', week: 'GEN', complete: 'DONE', log: 'LOG' }

  return (
    <>
      <SectionHead title="Live Activity" sub="All platform events, newest first" />
      <Panel>
        {events.length === 0 && <EmptyState msg="No activity recorded yet" />}
        {events.map((e, i) => (
          <div key={e.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 24px', borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[e.type] ?? C.textDim, boxShadow: `0 0 8px ${TYPE_COLOR[e.type] ?? C.textDim}` }} />
              {i < events.length - 1 && <div style={{ width: 1, height: 26, background: C.border, marginTop: 4 }} />}
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '3px 6px', borderRadius: 4, background: `${TYPE_COLOR[e.type]}14`, color: TYPE_COLOR[e.type] ?? C.textDim, border: `1px solid ${TYPE_COLOR[e.type]}30`, flexShrink: 0, marginTop: 1, minWidth: 36, textAlign: 'center', fontFamily: 'monospace' }}>
              {TYPE_LABEL[e.type] ?? '—'}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13 }}><strong style={{ fontWeight: 700, color: C.text }}>{e.userName}</strong><span style={{ color: C.textMid }}> — {e.detail}</span></p>
            </div>
            <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0, fontFamily: 'monospace' }}>{fmtRelative(e.timestamp)}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

// ─── TODOS TAB ────────────────────────────────────────────────────────────────
function TodosTab({ todos, onRefresh }: { todos: TodoRow[]; onRefresh: () => void }) {
  const [newTodo, setNewTodo] = useState('')
  const [priority, setPriority] = useState('medium')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [doneOpen, setDoneOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  function toggleExpand(id: string) { setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function addTodo() {
    if (!newTodo.trim()) return
    setSaving(true)
    await supabase.from('todos').insert({ content: newTodo.trim(), status: 'pending', priority, category: 'general' })
    setNewTodo(''); await onRefresh(); flash('Todo added'); setSaving(false)
  }

  async function toggleTodo(todo: TodoRow) {
    await supabase.from('todos').update({ status: todo.status === 'pending' ? 'done' : 'pending', updated_at: new Date().toISOString() }).eq('id', todo.id)
    await onRefresh()
  }

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id); await onRefresh()
  }

  const active = todos.filter(t => t.status === 'pending')
  const done = todos.filter(t => t.status === 'done')

  return (
    <>
      <SectionHead title="Todos" sub={`${active.length} active · ${done.length} done`} />
      <Flash msg={msg} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="Add a new todo…" style={{ ...inputSt, flex: 1, minWidth: 200 }} />
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputSt, width: 110 }}>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <button onClick={addTodo} disabled={saving} style={addBtnSt}>Add</button>
      </div>

      {active.length === 0 && <EmptyState msg="No active todos — you're clear." />}
      {active.length > 0 && (
        <Panel style={{ marginBottom: 16 }}>
          {active.map((t, i) => {
            const long = t.content.length > 80
            const expanded = expandedIds.has(t.id)
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: i < active.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <button onClick={() => toggleTodo(t)} style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${C.border}`, background: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontFamily: 'inherit', marginTop: 1 }}>○</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    onClick={() => long && toggleExpand(t.id)}
                    style={{ fontSize: 13, color: C.text, cursor: long ? 'pointer' : 'default', display: 'block', whiteSpace: expanded ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: expanded ? 'clip' : 'ellipsis', lineHeight: 1.55 }}
                    title={long && !expanded ? t.content : undefined}
                  >{t.content}</span>
                  {long && <span onClick={() => toggleExpand(t.id)} style={{ fontSize: 10, color: C.accent, cursor: 'pointer', fontFamily: 'monospace' }}>{expanded ? '▲ collapse' : '▼ expand'}</span>}
                </div>
                {t.priority === 'high' && <span style={{ fontSize: 9, fontWeight: 800, color: C.red, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', flexShrink: 0, marginTop: 3 }}>High</span>}
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', flexShrink: 0, marginTop: 3 }}>{fmtDate(t.created_at)}</span>
                <button onClick={() => deleteTodo(t.id)} style={deleteBtnSt}>✕</button>
              </div>
            )
          })}
        </Panel>
      )}

      {done.length > 0 && (
        <>
          <button onClick={() => setDoneOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', marginTop: 8, fontFamily: 'monospace' }}>
            <span style={{ fontSize: 10 }}>{doneOpen ? '▼' : '▶'}</span> Completed ({done.length})
          </button>
          {doneOpen && (
            <Panel style={{ marginTop: 8 }}>
              {done.map((t, i) => {
                const long = t.content.length > 80
                const expanded = expandedIds.has(t.id)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', borderBottom: i < done.length - 1 ? `1px solid ${C.border}` : 'none', opacity: 0.5 }}>
                    <button onClick={() => toggleTodo(t)} style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${C.accent}`, background: C.accentDim, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontSize: 11, fontFamily: 'inherit', marginTop: 1 }}>✓</button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        onClick={() => long && toggleExpand(t.id)}
                        style={{ fontSize: 13, textDecoration: 'line-through', color: C.textMid, cursor: long ? 'pointer' : 'default', display: 'block', whiteSpace: expanded ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: expanded ? 'clip' : 'ellipsis', lineHeight: 1.55 }}
                      >{t.content}</span>
                      {long && <span onClick={() => toggleExpand(t.id)} style={{ fontSize: 10, color: C.accent, cursor: 'pointer', fontFamily: 'monospace' }}>{expanded ? '▲ collapse' : '▼ expand'}</span>}
                    </div>
                  </div>
                )
              })}
            </Panel>
          )}
        </>
      )}
    </>
  )
}

// ─── IDEAS TAB ────────────────────────────────────────────────────────────────
function IdeasTab({ ideas, onRefresh }: { ideas: IdeaRow[]; onRefresh: () => void }) {
  const [newIdea, setNewIdea] = useState('')
  const [category, setCategory] = useState('General')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  function toggleExpand(id: string) { setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function addIdea() {
    if (!newIdea.trim()) return
    setSaving(true)
    await supabase.from('ideas').insert({ content: newIdea.trim(), category })
    setNewIdea(''); await onRefresh(); flash('Idea saved'); setSaving(false)
  }

  return (
    <>
      <SectionHead title="Ideas" sub={`${ideas.length} captured — ideas are permanent`} />
      <Flash msg={msg} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={newIdea} onChange={e => setNewIdea(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIdea()} placeholder="Capture an idea…" style={{ ...inputSt, flex: 1, minWidth: 200 }} />
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputSt, width: 130 }}>
          {['General', 'Billing', 'UI/UX', 'Features', 'Marketing', 'Analytics'].map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={addIdea} disabled={saving} style={addBtnSt}>Save</button>
      </div>

      <Panel>
        {ideas.length === 0 && <EmptyState msg="No ideas yet" />}
        {ideas.map((idea, i) => {
          const long = idea.content.length > 90
          const expanded = expandedIds.has(idea.id)
          return (
            <div key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: i < ideas.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 76, fontFamily: 'monospace', marginTop: 2, flexShrink: 0 }}>{idea.category}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  onClick={() => long && toggleExpand(idea.id)}
                  style={{ fontSize: 13, color: C.text, cursor: long ? 'pointer' : 'default', display: 'block', whiteSpace: expanded ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: expanded ? 'clip' : 'ellipsis', lineHeight: 1.55 }}
                >{idea.content}</span>
                {long && <span onClick={() => toggleExpand(idea.id)} style={{ fontSize: 10, color: C.accent, cursor: 'pointer', fontFamily: 'monospace' }}>{expanded ? '▲ collapse' : '▼ read more'}</span>}
              </div>
              <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>{fmtDate(idea.created_at)}</span>
            </div>
          )
        })}
      </Panel>
    </>
  )
}

// ─── USER DETAIL PANEL ────────────────────────────────────────────────────────
function UserDetailPanel({ user, onClose, onSaved }: { user: UserStat; onClose: () => void; onSaved: () => void }) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flashMsg, setFlashMsg] = useState('')
  const [confirmAction, setConfirmAction] = useState<null | 'save' | 'delete_plan'>(null)
  const [deletingPlan, setDeletingPlan] = useState(false)

  const hasEdits = Object.keys(edits).length > 0

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data as Record<string, unknown>); setLoading(false) })
  }, [user.id])

  function setField(key: string, value: unknown) { setEdits(prev => ({ ...prev, [key]: value })) }
  function val(key: string) { return String((key in edits ? edits[key] : profile?.[key]) ?? '') }
  function showFlash(m: string) { setFlashMsg(m); setTimeout(() => setFlashMsg(''), 3000) }

  async function doSave() {
    setSaving(true); setConfirmAction(null)
    const { error } = await supabase.from('profiles').update(edits).eq('id', user.id)
    if (!error) { setEdits({}); showFlash('Profile updated.'); onSaved() } else showFlash('Save failed.')
    setSaving(false)
  }

  async function doDeletePlan() {
    setDeletingPlan(true); setConfirmAction(null)
    if (user.programId) {
      await Promise.all([
        supabase.from('weekly_plans').delete().eq('program_id', user.programId),
        supabase.from('day_completions').delete().eq('program_id', user.programId),
      ])
      await supabase.from('training_programs').delete().eq('id', user.programId)
    }
    setDeletingPlan(false); showFlash('Plan deleted.'); onSaved()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 4, display: 'block' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 70 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 560, maxWidth: '100vw', background: C.surface, borderLeft: `1px solid ${C.border}`, zIndex: 71, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: C.accent, flexShrink: 0 }}>
            {displayName(user)[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{displayName(user)}</p>
            <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px', marginLeft: 4 }}>×</button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[
            { label: 'Weeks', value: user.weeksGenerated || '—', color: user.weeksGenerated > 0 ? C.accent : C.textDim },
            { label: 'Days Done', value: user.daysCompleted || '—', color: user.daysCompleted > 0 ? C.green : C.textDim },
            { label: 'Logs', value: user.exerciseLogs || '—', color: user.exerciseLogs > 0 ? C.purple : C.textDim },
            { label: 'Joined', value: fmtDate(user.created_at), color: C.textDim },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: '10px', textAlign: 'center', borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {flashMsg && <div style={{ padding: '9px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, fontSize: 12, color: C.green, marginBottom: 16, fontFamily: 'monospace' }}>{flashMsg}</div>}
          {loading ? <p style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: '40px 0', fontFamily: 'monospace' }}>Loading profile…</p> : (
            <>
              {/* Plan */}
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10, fontFamily: 'monospace' }}>Training Plan</p>
              <div style={{ padding: '14px 16px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: user.hasProgram ? C.green : C.textDim }}>{user.hasProgram ? '● Active Program' : '○ No Program'}</p>
                  {user.hasProgram && <p style={{ fontSize: 11, color: C.textDim, marginTop: 3, fontFamily: 'monospace' }}>{user.weeksGenerated} weeks · {user.daysCompleted} days completed</p>}
                </div>
                {user.hasProgram && (
                  <button onClick={() => setConfirmAction('delete_plan')} disabled={deletingPlan} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {deletingPlan ? 'Deleting…' : '✕ Delete Plan'}
                  </button>
                )}
              </div>

              {/* Profile fields */}
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 12, fontFamily: 'monospace' }}>Profile Fields</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={lbl}>Display Name</label><input value={val('name')} onChange={e => setField('name', e.target.value || null)} style={inp} placeholder="—" /></div>
                <div><label style={lbl}>Gender</label>
                  <select value={val('gender')} onChange={e => setField('gender', e.target.value || null)} style={inp}>
                    <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </div>
                <div><label style={lbl}>Age</label><input type="number" value={val('age')} onChange={e => setField('age', e.target.value ? parseInt(e.target.value) : null)} style={inp} placeholder="—" /></div>
                <div><label style={lbl}>Days / Week</label><input type="number" min={1} max={7} value={val('days_per_week')} onChange={e => setField('days_per_week', e.target.value ? parseInt(e.target.value) : null)} style={inp} placeholder="—" /></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={lbl}>Sport(s)</label><input value={val('sport')} onChange={e => setField('sport', e.target.value || null)} style={inp} placeholder="e.g. Skateboarding" /></div>
              <div style={{ marginBottom: 12 }}><label style={lbl}>Goal</label><input value={val('goal')} onChange={e => setField('goal', e.target.value || null)} style={inp} placeholder="e.g. Build strength" /></div>
              <div style={{ marginBottom: 12 }}><label style={lbl}>Goal Notes</label><textarea value={val('goal_notes')} onChange={e => setField('goal_notes', e.target.value || null)} rows={3} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} placeholder="Additional context…" /></div>
              <div style={{ marginBottom: 12 }}><label style={lbl}>Prior Programs</label><textarea value={val('prior_programs')} onChange={e => setField('prior_programs', e.target.value || null)} rows={2} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} placeholder="e.g. Enjoyed P90X, tried 5/3/1" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Session Length</label><input value={val('session_length')} onChange={e => setField('session_length', e.target.value || null)} style={inp} placeholder="e.g. 60 min" /></div>
                <div><label style={lbl}>Workout Location</label>
                  <select value={val('workout_location')} onChange={e => setField('workout_location', e.target.value || null)} style={inp}>
                    <option value="">—</option><option value="gym">Gym</option><option value="home">Home</option><option value="both">Both</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save footer */}
        {hasEdits && (
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: C.amber, fontFamily: 'monospace' }}>⚠ Unsaved changes</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEdits({})} style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
              <button onClick={() => setConfirmAction('save')} disabled={saving} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save Changes →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 24 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <p style={{ fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 12 }}>{confirmAction === 'delete_plan' ? 'Delete Training Plan?' : 'Confirm Changes'}</p>
            <div style={{ padding: '12px 14px', background: confirmAction === 'delete_plan' ? 'rgba(239,68,68,0.06)' : C.amberDim, border: `1px solid ${confirmAction === 'delete_plan' ? 'rgba(239,68,68,0.3)' : C.amber + '50'}`, borderRadius: 8, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>
                {confirmAction === 'delete_plan'
                  ? `This will permanently delete all of ${displayName(user)}'s training data — program, all generated weeks, and completed days. Cannot be undone.`
                  : `Are you sure you want to make changes? This will create a permanent change to ${displayName(user)}'s account.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'none', color: C.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirmAction === 'delete_plan' ? doDeletePlan : doSave} disabled={saving || deletingPlan} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: confirmAction === 'delete_plan' ? C.red : C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {confirmAction === 'delete_plan' ? 'Yes, Delete' : 'Yes, Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── PROMOS TAB ───────────────────────────────────────────────────────────────
function PromosTab({ promos, onRefresh }: { promos: PromoRow[]; onRefresh: () => void }) {
  const [code, setCode] = useState('')
  const [role, setRole] = useState('beta')
  const [maxUses, setMaxUses] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function addPromo() {
    if (!code.trim()) return
    setSaving(true)
    await supabase.from('promo_codes').insert({ code: code.trim().toUpperCase(), role, max_uses: maxUses ? parseInt(maxUses) : 10 })
    setCode('')
    setMaxUses('')
    await onRefresh()
    flash('Promo code created')
    setSaving(false)
  }

  async function deletePromo(id: string) {
    await supabase.from('promo_codes').delete().eq('id', id)
    await onRefresh()
  }

  return (
    <>
      <SectionHead title="Promo Codes" sub="Distribute beta access" />
      <Flash msg={msg} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE (e.g. BETA2026)" style={{ ...inputSt, flex: 2, minWidth: 160, letterSpacing: '0.08em', fontFamily: 'monospace' }} />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputSt, width: 120 }}>
          <option value="ff">F&F Beta</option>
          <option value="beta">Beta Access</option>
          <option value="admin">Admin</option>
        </select>
        <input value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Max uses (blank = 10)" type="number" style={{ ...inputSt, flex: 1, minWidth: 140 }} />
        <button onClick={addPromo} disabled={saving} style={addBtnSt}>Create</button>
      </div>
      <p style={{ fontSize: 11, color: C.textDim, marginBottom: 20, fontFamily: 'monospace' }}>Each user can only redeem one code. Codes are case-insensitive.</p>

      <Panel>
        <TableHeader cols={[
          { label: 'Code', width: '1fr' },
          { label: 'Role', width: 100 },
          { label: 'Usage', width: '1.5fr' },
          { label: 'Created', width: 100 },
          { label: '', width: 40 },
        ]} />
        {promos.length === 0 && <EmptyState msg="No promo codes yet" />}
        {promos.map((p, i) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1.5fr 100px 40px', padding: '14px 20px', borderBottom: i < promos.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'monospace', fontSize: 14, color: C.accent, textShadow: `0 0 12px ${C.accent}60` }}>{p.code}</span>
            <RoleBadge role={p.role ?? 'beta'} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 3, background: C.surface2, borderRadius: 2, maxWidth: 140 }}>
                <div style={{ height: '100%', borderRadius: 2, background: C.accent, width: `${Math.min(((p.uses ?? 0) / (p.max_uses ?? 10)) * 100, 100)}%`, boxShadow: `0 0 6px ${C.accent}` }} />
              </div>
              <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{p.uses ?? 0} / {p.max_uses ?? '∞'}</span>
            </div>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{fmtDate(p.created_at)}</span>
            <button onClick={() => deletePromo(p.id)} style={deleteBtnSt}>✕</button>
          </div>
        ))}
      </Panel>
    </>
  )
}

// ─── TOKEN USAGE CARD ─────────────────────────────────────────────────────────
type TokenRow = { id: string; operation: string; api_route: string; model: string; input_tokens: number; output_tokens: number; estimated_cost_usd: string | number; metadata: Record<string, unknown> | null; created_at: string }

const OP_LABEL: Record<string, string> = {
  exercise_backfill: 'Backfill',
  plan_generation: 'Plan Gen',
  exercise_details: 'Ex Details',
}

// ─── EXERCISE LIBRARY CARD ───────────────────────────────────────────────────
type LibraryRow = { name_normalized: string; name_display: string; how: string | null; breathing: string | null; core: string | null; tip: string | null }

function ExerciseLibraryCard() {
  const [rows, setRows] = useState<LibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMissing, setFilterMissing] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const { data } = await supabase.from('exercise_library').select('name_normalized, name_display, how, breathing, core, tip').order('name_display')
    setRows(data ?? [])
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = rows.filter(r => {
    const matchesSearch = !search || r.name_display.toLowerCase().includes(search.toLowerCase())
    const hasGap = !r.how || !r.breathing || !r.core || !r.tip
    return matchesSearch && (!filterMissing || hasGap)
  })

  function exportCSV() {
    const header = 'name_display,name_normalized,has_how,has_breathing,has_core,has_tip\n'
    const body = rows.map(r =>
      [r.name_display, r.name_normalized, r.how ? 'yes' : 'no', r.breathing ? 'yes' : 'no', r.core ? 'yes' : 'no', r.tip ? 'yes' : 'no'].join(',')
    ).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'exercise_library.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const missingCount = rows.filter(r => !r.how || !r.breathing || !r.core || !r.tip).length

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Exercise Library</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
            {loading ? 'Loading…' : `${rows.length} exercises · ${missingCount} missing coaching details`}
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises…"
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 12, width: 180 }}
        />
        <button
          onClick={() => setFilterMissing(f => !f)}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${filterMissing ? C.amber : C.border}`, background: filterMissing ? C.amberDim : 'transparent', color: filterMissing ? C.amber : C.textMid, fontSize: 12, cursor: 'pointer' }}
        >
          {filterMissing ? '● Missing only' : 'Show missing'}
        </button>
        <button onClick={exportCSV} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, cursor: 'pointer' }}>
          Export CSV
        </button>
        <button onClick={() => load()} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, cursor: 'pointer' }}>
          ↻
        </button>
      </div>
      {!loading && (
        <div style={{ overflowX: 'auto', maxHeight: 400 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', padding: '8px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface2, fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', position: 'sticky', top: 0 }}>
            <span>Exercise</span><span style={{ textAlign: 'center' }}>How</span><span style={{ textAlign: 'center' }}>Breath</span><span style={{ textAlign: 'center' }}>Core</span><span style={{ textAlign: 'center' }}>Tip</span>
          </div>
          {filtered.map(r => (
            <div key={r.name_normalized} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', padding: '8px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
              <div>
                <div style={{ color: C.text, fontWeight: 500 }}>{r.name_display}</div>
                <div style={{ color: C.textDim, fontSize: 10, fontFamily: 'monospace' }}>{r.name_normalized}</div>
              </div>
              {(['how', 'breathing', 'core', 'tip'] as const).map(field => (
                <div key={field} style={{ textAlign: 'center', color: r[field] ? C.green : C.red, fontSize: 13 }}>
                  {r[field] ? '✓' : '✗'}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: C.textDim, fontSize: 13 }}>
              {search || filterMissing ? 'No exercises match your filter.' : 'No exercises in library yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TokenUsageCard() {
  const [rows, setRows] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('token_usage').select('*').order('created_at', { ascending: false }).limit(100)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalIn = rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0)
  const totalOut = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + parseFloat(String(r.estimated_cost_usd ?? 0)), 0)

  function downloadCsv() {
    const header = 'Operation,Route,Input Tokens,Output Tokens,Est Cost USD,Date'
    const lines = rows.map(r => `${r.operation},${r.api_route},${r.input_tokens},${r.output_tokens},${parseFloat(String(r.estimated_cost_usd ?? 0)).toFixed(6)},${r.created_at}`)
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'token-usage.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: C.purple, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Claude Token Usage</p>
          {!loading && rows.length > 0 && (
            <p style={{ fontSize: 11, color: C.textMid, fontFamily: 'monospace' }}>
              {rows.length} ops · <span style={{ color: C.accent }}>{(totalIn + totalOut).toLocaleString()} tokens</span> · <span style={{ color: C.amber }}>Est. ${totalCost.toFixed(4)} spent</span>
            </p>
          )}
          {!loading && rows.length === 0 && <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>No usage logged yet</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadCsv} disabled={rows.length === 0} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'none', color: C.textDim, fontSize: 11, cursor: rows.length === 0 ? 'default' : 'pointer', fontFamily: 'monospace' }}>CSV</button>
          <button onClick={load} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}>↺ Refresh</button>
        </div>
      </div>
      {loading && <p style={{ fontSize: 12, color: C.textDim, fontFamily: 'monospace', padding: '12px 0' }}>Loading…</p>}
      {!loading && rows.length > 0 && (
        <div style={{ background: C.bg, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px 80px 110px', padding: '7px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
            {['Operation', 'Route', 'In', 'Out', 'Cost', 'When'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px 80px 110px', padding: '8px 12px', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.purple, fontFamily: 'monospace', fontWeight: 700 }}>{OP_LABEL[r.operation] ?? r.operation}</span>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.api_route}</span>
                <span style={{ fontSize: 11, color: C.textMid, fontFamily: 'monospace' }}>{(r.input_tokens ?? 0).toLocaleString()}</span>
                <span style={{ fontSize: 11, color: C.textMid, fontFamily: 'monospace' }}>{(r.output_tokens ?? 0).toLocaleString()}</span>
                <span style={{ fontSize: 11, color: C.amber, fontFamily: 'monospace' }}>${parseFloat(String(r.estimated_cost_usd ?? 0)).toFixed(4)}</span>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{fmtRelative(r.created_at)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px 80px 110px', padding: '8px 12px', background: C.surface2, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, fontFamily: 'monospace' }}>TOTAL</span>
            <span />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>{totalIn.toLocaleString()}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>{totalOut.toLocaleString()}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, fontFamily: 'monospace' }}>${totalCost.toFixed(4)}</span>
            <span />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LIBRARY BACKFILL ─────────────────────────────────────────────────────────
function parseEx(s: string): string {
  return s.replace(/\s+\d+[×x]\d+.*$/i, '').replace(/\s+\d+\s*(sets?|reps?|each|min|sec).*$/i, '').trim()
}
function normalizeEx(n: string): string {
  return n.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}
const REST_EX = new Set(['Full rest', 'Light walk optional', 'Sleep 8+ hours'])

function extractAllExerciseNames(plans: unknown[][]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const week of plans) {
    for (const day of (week as Record<string, unknown>[]) ) {
      const type = day.type as string
      if (type === 'rest') continue
      // from movements array
      const movements = (day.movements as string[] | undefined) ?? []
      for (const m of movements) {
        const name = parseEx(m)
        if (name && !REST_EX.has(name) && !seen.has(normalizeEx(name))) {
          seen.add(normalizeEx(name)); result.push(name)
        }
      }
      // from daily_session blocks
      const ds = day.daily_session as Record<string, { exercises?: string[] }> | undefined
      if (ds) {
        for (const block of Object.values(ds)) {
          for (const ex of block.exercises ?? []) {
            const name = parseEx(ex)
            if (name && !REST_EX.has(name) && !seen.has(normalizeEx(name))) {
              seen.add(normalizeEx(name)); result.push(name)
            }
          }
        }
      }
    }
  }
  return result
}

function LibraryBackfillCard() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [log, setLog] = useState<string[]>([])
  const [stats, setStats] = useState<{ library: number; plan: number } | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)

  const addLog = (msg: string) => setLog(prev => [...prev, msg])

  useEffect(() => {
    if (status !== 'running') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Backfill is still running — leaving now will cut it off and waste tokens. Stay on this page.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [status])

  useEffect(() => {
    async function loadStats() {
      const [{ count: libCount }, { data: plans }] = await Promise.all([
        supabase.from('exercise_library').select('*', { count: 'exact', head: true }),
        supabase.from('weekly_plans').select('plan'),
      ])
      const allNames = extractAllExerciseNames((plans ?? []).map(p => p.plan as unknown[]))
      setStats({ library: libCount ?? 0, plan: allNames.length })
    }
    loadStats()
  }, [status])

  async function run() {
    setStatus('running'); setLog([])
    let totalIn = 0, totalOut = 0
    try {
      // ── Pre-flight: verify DB write access before spending any tokens ──────
      const testRow = { name_normalized: '__backfill_test__', name_display: 'Test', how: 'test', breathing: 'test', core: 'test', tip: 'test' }
      const { error: writeTestErr } = await supabase.from('exercise_library').upsert(testRow, { onConflict: 'name_normalized' })
      if (writeTestErr) {
        addLog(`✗ DB write blocked: ${writeTestErr.message}`)
        addLog(`Fix: run this SQL in Supabase SQL Editor, then retry:`)
        addLog(`CREATE POLICY "admin_all" ON exercise_library FOR ALL TO authenticated USING ((SELECT is_admin FROM profiles WHERE id = auth.uid())) WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));`)
        setStatus('error'); return
      }
      await supabase.from('exercise_library').delete().eq('name_normalized', '__backfill_test__')
      addLog('DB write access confirmed.')

      const { data: plans } = await supabase.from('weekly_plans').select('plan')
      if (!plans?.length) { addLog('No weekly plans found in database.'); setStatus('error'); return }
      addLog(`Found ${plans.length} weeks in database.`)

      const allNames = extractAllExerciseNames(plans.map(p => p.plan as unknown[]))
      addLog(`Extracted ${allNames.length} unique exercises across all weeks.`)

      // Fetch full library (no .in() filter) — avoids URL length limit truncation with 700+ names
      const { data: existing } = await supabase.from('exercise_library').select('name_normalized')
      const existingSet = new Set(existing?.map(e => e.name_normalized) ?? [])
      const missing = allNames.filter(n => !existingSet.has(normalizeEx(n)))

      if (missing.length === 0) { addLog('All exercises already have coaching details. Nothing to do.'); setStatus('done'); return }
      addLog(`${missing.length} exercises need coaching details. Generating in batches…`)

      const BATCH = 8
      const totalBatches = Math.ceil(missing.length / BATCH)
      let saved = 0
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH)
        const batchNum = Math.floor(i / BATCH) + 1
        addLog(`Batch ${batchNum}/${totalBatches}: ${batch.slice(0, 3).join(', ')}${batch.length > 3 ? '…' : ''}`)
        try {
          const res = await fetch('/api/generate-exercise-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exercises: batch }) })
          if (!res.ok) {
            const errBody = await res.text().catch(() => '')
            addLog(`  ✗ API error ${res.status}: ${errBody.slice(0, 120)}`)
            continue
          }
          if (res.ok) {
            const { details, usage } = await res.json()
            let batchSaved = 0
            let saveErr: string | null = null
            if (Array.isArray(details) && details.length > 0) {
              const { error: upsertErr } = await supabase.from('exercise_library').upsert(details, { onConflict: 'name_normalized' })
              if (upsertErr) {
                saveErr = upsertErr.message
              } else {
                batchSaved = details.length
                saved += batchSaved
                const { count } = await supabase.from('exercise_library').select('*', { count: 'exact', head: true })
                setStats(prev => prev ? { ...prev, library: count ?? prev.library } : prev)
                setBatchProgress({ done: batchNum, total: totalBatches })
              }
            }
            if (usage) {
              totalIn += usage.input_tokens ?? 0
              totalOut += usage.output_tokens ?? 0
              const batchCost = ((usage.input_tokens ?? 0) * 3 + (usage.output_tokens ?? 0) * 15) / 1_000_000
              const saveLabel = saveErr ? `✗ save failed: ${saveErr}` : `✓ ${batchSaved} saved`
              addLog(`  ${saveLabel} · ${(usage.input_tokens ?? 0).toLocaleString()}in / ${(usage.output_tokens ?? 0).toLocaleString()}out · $${batchCost.toFixed(4)}`)
              await supabase.from('token_usage').insert({
                operation: 'exercise_backfill',
                api_route: '/api/generate-exercise-details',
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                estimated_cost_usd: batchCost,
                metadata: { batch: batchNum, total_batches: totalBatches, exercise_count: batch.length },
              })
            } else if (saveErr) {
              addLog(`  ✗ save failed: ${saveErr}`)
            }
          }
        } catch { addLog(`  ⚠ Batch ${batchNum} failed, continuing…`) }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      const totalCost = (totalIn * 3 + totalOut * 15) / 1_000_000
      addLog(`Done. ${saved} exercises saved · ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out tokens · Est. $${totalCost.toFixed(4)}`)
      setStatus('done')
    } catch (e) {
      addLog(`Error: ${String(e)}`); setStatus('error')
    }
  }

  const pct = batchProgress && status === 'running' ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0
  const missing = stats ? Math.max(stats.plan - stats.library, 0) : null

  return (
    <div style={{ padding: '20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 24 }}>
      {status === 'running' && <style>{`@keyframes bfPulse{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.5)}50%{box-shadow:0 0 0 7px rgba(59,130,246,0)}} @keyframes bfDot{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: C.accent, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Exercise Library Backfill</p>
          <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>Pre-generate coaching details for every exercise in your plan. Run once — free forever after.</p>
          {stats && (
            <p style={{ fontSize: 11, color: C.textMid, marginTop: 6, fontFamily: 'monospace' }}>
              Library: <span style={{ color: C.green }}>{stats.library} saved</span> · Plan: <span style={{ color: C.amber }}>{stats.plan} unique exercises</span>
              {missing === 0 ? <span style={{ color: C.green }}> ✓ fully populated</span> : <span style={{ color: status === 'running' ? C.accent : C.amber }}> · {missing} missing</span>}
            </p>
          )}
        </div>
        <button
          onClick={run}
          disabled={status === 'running'}
          style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${status === 'done' ? 'rgba(34,197,94,0.3)' : C.accentBorder}`, background: status === 'running' ? 'rgba(59,130,246,0.15)' : status === 'done' ? C.greenDim : C.accentDim, color: status === 'running' ? C.accent : status === 'done' ? C.green : C.accent, fontWeight: 700, fontSize: 13, cursor: status === 'running' ? 'not-allowed' : 'pointer', flexShrink: 0, whiteSpace: 'nowrap', animation: status === 'running' ? 'bfPulse 1.8s ease-in-out infinite' : 'none' }}
        >
          {status === 'running' ? <span>● Running…</span> : status === 'done' ? '✓ Done' : 'Backfill Now'}
        </button>
      </div>

      {status === 'running' && batchProgress && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace', fontWeight: 700 }}>
              <span style={{ animation: 'bfDot 1s ease-in-out infinite', display: 'inline-block' }}>●</span> Batch {batchProgress.done}/{batchProgress.total} · {stats?.library ?? 0} saved · {missing} remaining
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{pct}%</span>
          </div>
          <div style={{ height: 5, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: C.accent, borderRadius: 4, transition: 'width 0.6s ease', boxShadow: `0 0 8px ${C.accent}` }} />
          </div>
        </div>
      )}

      {status === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 10, fontSize: 12, color: C.amber }}>
          <span>⚠</span>
          <span><strong>Do not navigate away.</strong> Leaving this page will cut off the process mid-batch and waste tokens. Keep this tab open until you see "✓ Done".</span>
        </div>
      )}
      {log.length > 0 && (
        <div style={{ background: C.bg, borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: C.textMid, lineHeight: 1.8, maxHeight: 200, overflowY: 'auto' }}>
          {log.map((l, i) => <div key={i} style={{ color: l.startsWith('Done') ? C.green : l.includes('✗') ? C.red : l.startsWith('⚠') ? C.amber : C.textMid }}>{l}</div>)}
        </div>
      )}
    </div>
  )
}

// ─── PLACEHOLDER TAB ──────────────────────────────────────────────────────────
function PlaceholderTab({ label, bullets }: { label: string; bullets: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${C.accent}20` }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <p style={{ fontWeight: 700, fontSize: 17, color: C.text }}>{label}</p>
      <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center', maxWidth: 300, lineHeight: 1.6, fontFamily: 'monospace' }}>This section is coming in the next build phase.</p>
      {bullets.length > 0 && (
        <div style={{ marginTop: 8, padding: '16px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, maxWidth: 360, width: '100%' }}>
          {bullets.map(b => (
            <div key={b} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ color: C.accent, fontSize: 12, flexShrink: 0, marginTop: 1 }}>→</span>
              <span style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Analytics',
    items: [
      { id: 'overview' as Tab, label: 'Overview' },
      { id: 'users' as Tab, label: 'Users' },
      { id: 'activity' as Tab, label: 'Live Activity' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'todos' as Tab, label: 'Todos' },
      { id: 'ideas' as Tab, label: 'Ideas' },
      { id: 'promos' as Tab, label: 'Promos' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { id: 'marketing' as Tab, label: 'Marketing' },
      { id: 'partners' as Tab, label: 'Partners' },
    ],
  },
  {
    label: 'Strategy',
    items: [
      { id: 'launchpad' as Tab, label: 'Launchpad' },
    ],
  },
  {
    label: 'Dev Tools',
    items: [
      { id: 'health' as Tab, label: 'Health Monitor' },
    ],
  },
]

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin, loading: authLoading, startImpersonation } = useAuth()
  const router = useRouter()

  function handleImpersonate(userId: string, name: string) {
    startImpersonation(userId, name)
    router.push('/')
  }
  const [tab, setTab] = useState<Tab>('overview')
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Data state
  const [users, setUsers] = useState<UserStat[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [todos, setTodos] = useState<TodoRow[]>([])
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [promos, setPromos] = useState<PromoRow[]>([])
  const [kpis, setKpis] = useState<{ label: string; value: string | number; sub: string; accent: string }[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserStat | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) router.replace('/today')
  }, [authLoading, user, isAdmin, router])

  const loadAll = useCallback(async () => {
    if (!isAdmin) return
    setDataLoading(true)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [profilesRes, programsRes, weekPlansRes, completionsRes, logsRes, todosRes, ideasRes, promosRes, recentSignupsRes] = await Promise.all([
      supabase.from('profiles').select('id, email, name, full_name, role, is_admin, created_at').order('created_at', { ascending: false }),
      supabase.from('training_programs').select('id, user_id'),
      supabase.from('weekly_plans').select('program_id, week_number, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('day_completions').select('user_id, week_number, day_index, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('workout_logs').select('user_id, exercise_normalized, weight, sets, reps, weight_unit, logged_at').order('logged_at', { ascending: false }).limit(100),
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('ideas').select('*').order('created_at', { ascending: false }),
      supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()),
    ])

    const profiles: ProfileRow[] = profilesRes.data ?? []
    const programs = programsRes.data ?? []
    const weekPlans = weekPlansRes.data ?? []
    const completions = completionsRes.data ?? []
    const logs = logsRes.data ?? []

    // Build lookup maps
    const profileMap = new Map(profiles.map(p => [p.id, p]))
    const programIdToUserId = new Map(programs.map(p => [p.id, p.user_id]))
    const userIdToProgram = new Map(programs.map(p => [p.user_id, p.id]))

    const weeksByProgram: Record<string, number> = {}
    weekPlans.forEach(wp => { weeksByProgram[wp.program_id] = (weeksByProgram[wp.program_id] ?? 0) + 1 })

    const daysByUser: Record<string, number> = {}
    completions.forEach(c => { daysByUser[c.user_id] = (daysByUser[c.user_id] ?? 0) + 1 })

    const logsByUser: Record<string, number> = {}
    logs.forEach(l => { logsByUser[l.user_id] = (logsByUser[l.user_id] ?? 0) + 1 })

    // Last active per user
    const lastActiveByUser: Record<string, string> = {}
    logs.forEach(l => {
      if (!lastActiveByUser[l.user_id] || l.logged_at > lastActiveByUser[l.user_id]) lastActiveByUser[l.user_id] = l.logged_at
    })
    completions.forEach(c => {
      if (!lastActiveByUser[c.user_id] || c.created_at > lastActiveByUser[c.user_id]) lastActiveByUser[c.user_id] = c.created_at
    })

    // User stats
    const userStats: UserStat[] = profiles.map(p => {
      const programId = userIdToProgram.get(p.id) ?? null
      return {
        ...p,
        hasProgram: !!programId,
        programId,
        weeksGenerated: programId ? (weeksByProgram[programId] ?? 0) : 0,
        daysCompleted: daysByUser[p.id] ?? 0,
        exerciseLogs: logsByUser[p.id] ?? 0,
        lastActive: lastActiveByUser[p.id] ?? null,
      }
    })

    // Activity feed
    const activityEvents: ActivityEvent[] = []

    profiles.slice(0, 10).forEach(p => {
      activityEvents.push({ key: `signup-${p.id}`, type: 'signup', userName: displayName(p), detail: `Joined · ${p.role} tier`, timestamp: p.created_at })
    })
    weekPlans.slice(0, 15).forEach(wp => {
      const userId = programIdToUserId.get(wp.program_id)
      if (!userId) return
      const profile = profileMap.get(userId)
      if (!profile) return
      activityEvents.push({ key: `week-${wp.program_id}-${wp.week_number}-${wp.created_at}`, type: 'week', userName: displayName(profile), detail: `Generated Week ${wp.week_number}`, timestamp: wp.created_at })
    })
    completions.slice(0, 15).forEach(c => {
      const profile = profileMap.get(c.user_id)
      if (!profile) return
      activityEvents.push({ key: `complete-${c.user_id}-${c.week_number}-${c.day_index}-${c.created_at}`, type: 'complete', userName: displayName(profile), detail: `Completed Day ${c.day_index + 1} · Week ${c.week_number}`, timestamp: c.created_at })
    })
    logs.slice(0, 15).forEach(l => {
      const profile = profileMap.get(l.user_id)
      if (!profile) return
      const name = l.exercise_normalized.replace(/_/g, ' ')
      const detail2 = [l.weight != null ? `${l.weight} ${l.weight_unit ?? 'lbs'}` : null, l.sets != null ? `${l.sets}×${l.reps ?? '?'}` : null].filter(Boolean).join(' · ')
      activityEvents.push({ key: `log-${l.user_id}-${l.logged_at}`, type: 'log', userName: displayName(profile), detail: `Logged ${name}${detail2 ? ` · ${detail2}` : ''}`, timestamp: l.logged_at })
    })
    activityEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    // KPIs
    const betaCount = profiles.filter(p => p.role === 'beta').length
    const recentCount = recentSignupsRes.count ?? 0
    const computedKpis = [
      { label: 'Total Users', value: profiles.length, sub: `↑ ${recentCount} this week`, accent: C.accent },
      { label: 'Beta Access', value: betaCount, sub: `${profiles.length > 0 ? Math.round((betaCount / profiles.length) * 100) : 0}% of total`, accent: C.green },
      { label: 'Programs Active', value: programs.length, sub: `${profiles.length > 0 ? Math.round((programs.length / profiles.length) * 100) : 0}% activation`, accent: C.accent },
      { label: 'Weeks Generated', value: weekPlans.length, sub: 'across all users', accent: C.purple },
      { label: 'Days Completed', value: completions.length, sub: 'total check-ins', accent: C.green },
      { label: 'Exercise Logs', value: logs.length, sub: 'sets recorded', accent: C.amber },
    ]

    setUsers(userStats)
    setEvents(activityEvents.slice(0, 40))
    setKpis(computedKpis)
    setTodos(todosRes.data ?? [])
    setIdeas(ideasRes.data ?? [])
    setPromos(promosRes.data ?? [])
    setDataLoading(false)
  }, [isAdmin])

  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin, loadAll])

  async function handleRoleChange(userId: string, newRole: string) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    await loadAll()
  }

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.textDim, fontSize: 14 }}>
        {authLoading ? 'Loading…' : 'Access denied'}
      </div>
    )
  }

  const activeTodoCount = todos.filter(t => t.status === 'pending').length

  function selectTab(t: Tab) {
    setTab(t)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', zIndex: 50 }}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 59 }} />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, background: C.surface, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-220px)',
          transition: 'transform 0.25s ease',
          boxShadow: sidebarOpen ? '4px 0 32px rgba(0,0,0,0.7)' : 'none',
        } : {
          flexShrink: 0, height: '100%',
        }),
      }}>

        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Movement OS</p>
              <p style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, padding: '4px 10px 6px' }}>{group.label}</p>
              {group.items.map(item => {
                const active = tab === item.id
                const badge = item.id === 'todos' ? (activeTodoCount > 0 ? activeTodoCount : null)
                           : item.id === 'ideas' ? (ideas.length > 0 ? ideas.length : null)
                           : null
                return (
                  <button key={item.id} onClick={() => selectTab(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, border: 'none', background: active ? C.accentDim : 'none', color: active ? C.accent : C.textMid, fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer', marginBottom: 2, textAlign: 'left', transition: 'all 0.1s', fontFamily: 'inherit' }}>
                    <span>{item.label}</span>
                    {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: active ? C.accentBorder : C.surface2, color: active ? C.accent : C.textDim }}>{badge}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={{ fontSize: 11, color: C.textDim }}>All systems operational</span>
          </div>
          <button onClick={() => router.push('/today')} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            ← Back to App
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{ height: 56, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 28px', background: C.surface, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 6, color: C.textMid, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{NAV_GROUPS.flatMap(g => g.items).find(i => i.id === tab)?.label}</span>
            {dataLoading && <span style={{ fontSize: 11, color: C.textDim }}>· loading…</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isMobile && <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: C.accentDim, border: `1px solid ${C.accentBorder}`, color: C.accent, fontWeight: 700, letterSpacing: '0.06em' }}>ADMIN</span>}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px 40px' : '28px 28px 60px' }}>
          {tab === 'overview' && <OverviewTab users={users} events={events} kpis={kpis} isMobile={isMobile} />}
          {tab === 'users' && <UsersTab users={users} onRoleChange={handleRoleChange} onZoomIn={setSelectedUser} onImpersonate={handleImpersonate} />}
          {tab === 'activity' && <ActivityTab events={events} />}
          {tab === 'todos' && <TodosTab todos={todos} onRefresh={loadAll} />}
          {tab === 'ideas' && <IdeasTab ideas={ideas} onRefresh={loadAll} />}
          {tab === 'promos' && <PromosTab promos={promos} onRefresh={loadAll} />}
          {tab === 'marketing' && (
            <PlaceholderTab label="Marketing Control Panel" bullets={['SEO recommendations & LLM visibility', 'Facebook/Meta · LinkedIn · PPC campaign management', 'Reddit content strategy & educational calendar', 'Ad spend ROI tracking & conversion funnels']} />
          )}
          {tab === 'partners' && (
            <PlaceholderTab label="Partner Management" bullets={['Physical therapists, nutritionists, trainers, influencers', 'Track audience size, performance, revenue contribution', 'Revenue-sharing model — partners earn on referrals', 'Partner portal: their own login, analytics, expected pay']} />
          )}
          {tab === 'launchpad' && <LaunchpadTab />}
          {tab === 'health' && <><TokenUsageCard /><LibraryBackfillCard /><ExerciseLibraryCard /><HealthTab /></>}
        </main>
      </div>
    </div>

    {selectedUser && (
      <UserDetailPanel
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onSaved={() => { loadAll(); setSelectedUser(prev => prev ? { ...prev } : null) }}
      />
    )}
    </>
  )
}
