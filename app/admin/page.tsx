'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import LaunchpadTab from '@/components/admin/LaunchpadTab'

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#020208',
  surface: 'rgba(0,15,50,0.85)',
  surface2: 'rgba(0,25,70,0.6)',
  border: 'rgba(0,180,255,0.13)',
  accent: '#00b4ff',
  accentDim: 'rgba(0,180,255,0.1)',
  accentBorder: 'rgba(0,180,255,0.28)',
  green: '#00ff88',
  greenDim: 'rgba(0,255,136,0.08)',
  amber: '#ffb340',
  amberDim: 'rgba(255,179,64,0.1)',
  red: '#ff4466',
  purple: '#c084fc',
  text: '#dff0ff',
  textMid: '#5a9ab8',
  textDim: '#2e6880',
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'users' | 'activity' | 'todos' | 'ideas' | 'promos' | 'marketing' | 'partners' | 'launchpad'
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
    free: { bg: 'rgba(0,180,255,0.06)', color: C.textMid },
  }
  const s = cfg[role] ?? cfg.free
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.color}30`, fontFamily: 'monospace' }}>{role}</span>
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: C.text, marginBottom: sub ? 4 : 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 12, color: C.textDim, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{sub}</p>}
    </div>
  )
}

function TableHeader({ cols }: { cols: { label: string; width?: string | number }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols.map(c => c.width ?? '1fr').join(' '), padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: 'rgba(0,180,255,0.04)' }}>
      {cols.map(c => <span key={c.label} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, fontFamily: 'monospace' }}>{c.label}</span>)}
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', backdropFilter: 'blur(8px)', ...style }}>{children}</div>
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
            backdropFilter: 'blur(8px)',
            boxShadow: `0 0 20px ${k.accent}08`,
          }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10, fontFamily: 'monospace' }}>{k.label}</p>
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
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? C.accentDim : 'rgba(0,25,60,0.8)', border: `1px solid ${u.role === 'admin' ? C.accentBorder : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: u.role === 'admin' ? C.accent : C.textMid, flexShrink: 0, fontFamily: 'monospace' }}>
                {displayName(u)[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{u.email}</p>
                <p style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{u.hasProgram ? `${u.weeksGenerated}w · ${u.daysCompleted} days` : 'No plan'}</p>
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
function UsersTab({ users, onRoleChange }: { users: UserStat[]; onRoleChange: (id: string, role: string) => Promise<void> }) {
  const betaCount = users.filter(u => u.role === 'beta').length
  const freeCount = users.filter(u => u.role === 'free').length

  return (
    <>
      <SectionHead title="Users" sub={`${users.length} total · ${betaCount} beta · ${freeCount} free`} />
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
        ]} />
        {users.length === 0 && <EmptyState msg="No users yet" />}
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 70px 70px 60px 60px 100px 90px 110px', padding: '13px 20px', borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', gap: 0 }}>
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
            {u.role === 'free' ? (
              <button onClick={() => onRoleChange(u.id, 'beta')} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                → Beta
              </button>
            ) : u.role === 'beta' ? (
              <button onClick={() => onRoleChange(u.id, 'free')} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textDim, fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}>
                Revoke
              </button>
            ) : (
              <span style={{ fontSize: 10, color: C.amber, fontFamily: 'monospace' }}>Admin</span>
            )}
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

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function addTodo() {
    if (!newTodo.trim()) return
    setSaving(true)
    await supabase.from('todos').insert({ content: newTodo.trim(), status: 'pending', priority, category: 'general' })
    setNewTodo('')
    await onRefresh()
    flash('Todo added')
    setSaving(false)
  }

  async function toggleTodo(todo: TodoRow) {
    await supabase.from('todos').update({ status: todo.status === 'pending' ? 'done' : 'pending', updated_at: new Date().toISOString() }).eq('id', todo.id)
    await onRefresh()
  }

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id)
    await onRefresh()
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
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={addTodo} disabled={saving} style={addBtnSt}>Add</button>
      </div>

      {active.length > 0 && (
        <Panel style={{ marginBottom: 16 }}>
          {active.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < active.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <button onClick={() => toggleTodo(t)} style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${C.border}`, background: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontFamily: 'inherit' }}>○</button>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>{t.content}</span>
              {t.priority === 'high' && <span style={{ fontSize: 9, fontWeight: 800, color: C.red, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>High</span>}
              <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{fmtDate(t.created_at)}</span>
              <button onClick={() => deleteTodo(t.id)} style={deleteBtnSt}>✕</button>
            </div>
          ))}
        </Panel>
      )}
      {active.length === 0 && <EmptyState msg="No active todos — you're clear." />}

      {done.length > 0 && (
        <>
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10, marginTop: 8, fontFamily: 'monospace' }}>Done ({done.length})</p>
          <Panel>
            {done.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < done.length - 1 ? `1px solid ${C.border}` : 'none', opacity: 0.45 }}>
                <button onClick={() => toggleTodo(t)} style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${C.accent}`, background: C.accentDim, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontSize: 11, fontFamily: 'inherit' }}>✓</button>
                <span style={{ flex: 1, fontSize: 13, textDecoration: 'line-through', color: C.textMid }}>{t.content}</span>
                <button onClick={() => deleteTodo(t.id)} style={deleteBtnSt}>✕</button>
              </div>
            ))}
          </Panel>
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

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function addIdea() {
    if (!newIdea.trim()) return
    setSaving(true)
    await supabase.from('ideas').insert({ content: newIdea.trim(), category })
    setNewIdea('')
    await onRefresh()
    flash('Idea saved')
    setSaving(false)
  }

  async function deleteIdea(id: string) {
    await supabase.from('ideas').delete().eq('id', id)
    await onRefresh()
  }

  return (
    <>
      <SectionHead title="Ideas" sub={`${ideas.length} captured`} />
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
        {ideas.map((idea, i) => (
          <div key={idea.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < ideas.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 76, fontFamily: 'monospace' }}>{idea.category}</span>
            <span style={{ flex: 1, fontSize: 13, color: C.text }}>{idea.content}</span>
            <span style={{ fontSize: 10, color: C.textDim, marginRight: 4, fontFamily: 'monospace' }}>{fmtDate(idea.created_at)}</span>
            <button onClick={() => deleteIdea(idea.id)} style={deleteBtnSt}>✕</button>
          </div>
        ))}
      </Panel>
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
              <div style={{ flex: 1, height: 3, background: 'rgba(0,180,255,0.1)', borderRadius: 2, maxWidth: 140 }}>
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
        <div style={{ marginTop: 8, padding: '16px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, maxWidth: 360, width: '100%', backdropFilter: 'blur(8px)' }}>
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
]

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
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
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020208', color: '#2e6880', fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
        {authLoading ? '// AUTHENTICATING…' : '// ACCESS DENIED'}
      </div>
    )
  }

  const activeTodoCount = todos.filter(t => t.status === 'pending').length

  function selectTab(t: Tab) {
    setTab(t)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden',
      background: '#020208',
      backgroundImage: 'linear-gradient(rgba(0,180,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.025) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
      color: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      zIndex: 50,
    }}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 59 }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        background: 'rgba(0,8,28,0.96)',
        borderRight: `1px solid rgba(0,180,255,0.18)`,
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(12px)',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-220px)',
          transition: 'transform 0.25s ease',
          boxShadow: sidebarOpen ? '4px 0 48px rgba(0,0,0,0.9)' : 'none',
        } : {
          flexShrink: 0, height: '100%',
          boxShadow: 'inset -1px 0 0 rgba(0,180,255,0.06)',
        }),
      }}>

        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid rgba(0,180,255,0.12)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${C.accent}30` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={C.accent}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 13, color: C.text, letterSpacing: '0.02em' }}>Movement OS</p>
              <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace' }}>Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, padding: '4px 10px 6px', fontFamily: 'monospace' }}>{group.label}</p>
              {group.items.map(item => {
                const active = tab === item.id
                const badge = item.id === 'todos' ? (activeTodoCount > 0 ? activeTodoCount : null)
                           : item.id === 'ideas' ? (ideas.length > 0 ? ideas.length : null)
                           : null
                return (
                  <button key={item.id} onClick={() => selectTab(item.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 6, border: 'none',
                    background: active ? 'rgba(0,180,255,0.1)' : 'none',
                    color: active ? C.accent : C.textMid,
                    fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer', marginBottom: 2, textAlign: 'left',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                    boxShadow: active ? `inset 0 0 0 1px rgba(0,180,255,0.2)` : 'none',
                  }}>
                    <span>{item.label}</span>
                    {badge && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: active ? 'rgba(0,180,255,0.2)' : 'rgba(0,180,255,0.07)', color: active ? C.accent : C.textDim, fontFamily: 'monospace' }}>{badge}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid rgba(0,180,255,0.12)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', letterSpacing: '0.04em' }}>All systems operational</span>
          </div>
          <button onClick={() => router.push('/today')} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid rgba(0,180,255,0.12)`, background: 'none', color: C.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left', letterSpacing: '0.04em' }}>
            ← Back to App
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 56, borderBottom: `1px solid rgba(0,180,255,0.12)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0 16px' : '0 28px',
          background: 'rgba(0,5,20,0.9)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 6, color: C.textMid, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{NAV_GROUPS.flatMap(g => g.items).find(i => i.id === tab)?.label}</span>
            {dataLoading && <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', letterSpacing: '0.06em' }}>· syncing…</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && (
              <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.1em', color: C.textDim }}>
                // SYSTEM ACTIVE
              </span>
            )}
            {!isMobile && <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: C.accentDim, border: `1px solid ${C.accentBorder}`, color: C.accent, fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace' }}>ADMIN</span>}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: C.accent, flexShrink: 0, fontFamily: 'monospace', boxShadow: `0 0 12px ${C.accent}30` }}>
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px 40px' : '28px 28px 60px' }}>
          {tab === 'overview' && <OverviewTab users={users} events={events} kpis={kpis} isMobile={isMobile} />}
          {tab === 'users' && <UsersTab users={users} onRoleChange={handleRoleChange} />}
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
        </main>
      </div>
    </div>
  )
}
