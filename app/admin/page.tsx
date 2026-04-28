'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

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
type Tab = 'overview' | 'users' | 'activity' | 'todos' | 'ideas' | 'promos' | 'marketing' | 'partners'
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
    free: { bg: 'rgba(110,118,129,0.1)', color: C.textDim },
  }
  const s = cfg[role] ?? cfg.free
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: s.bg, color: s.color }}>{role}</span>
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: sub ? 4 : 0 }}>{title}</h2>
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
  return <p style={{ fontSize: 13, color: C.textDim, padding: '32px 20px', textAlign: 'center' }}>{msg}</p>
}

function Flash({ msg }: { msg: string }) {
  if (!msg) return null
  return <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 13, color: C.green, marginBottom: 16 }}>{msg}</div>
}

const inputSt: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const addBtnSt: React.CSSProperties = { padding: '9px 16px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }
const deleteBtnSt: React.CSSProperties = { background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 13, padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ users, events, kpis }: {
  users: UserStat[]
  events: ActivityEvent[]
  kpis: { label: string; value: string | number; sub: string; accent: string }[]
}) {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const ACTIVITY_COLOR: Record<string, string> = { signup: C.amber, week: C.accent, complete: C.green, log: C.purple }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{now}</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Platform Overview</h2>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ padding: '20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, borderTop: `2px solid ${k.accent}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', color: C.text, marginBottom: 4 }}>{k.value}</p>
            <p style={{ fontSize: 12, color: String(k.sub).startsWith('↑') ? C.green : C.textDim }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Activity + Users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>Recent Activity</p>
          </div>
          {events.length === 0 && <EmptyState msg="No activity yet" />}
          {events.slice(0, 8).map(e => (
            <div key={e.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: ACTIVITY_COLOR[e.type] ?? C.textDim, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13 }}><strong style={{ fontWeight: 700 }}>{e.userName}</strong> — {e.detail}</p>
              </div>
              <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>{fmtRelative(e.timestamp)}</span>
            </div>
          ))}
        </Panel>

        <Panel>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>Users</p>
          </div>
          {users.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? C.accentDim : C.surface2, border: `1px solid ${u.role === 'admin' ? C.accentBorder : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: u.role === 'admin' ? C.accent : C.textMid, flexShrink: 0 }}>
                {displayName(u)[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                <p style={{ fontSize: 11, color: C.textDim }}>{u.hasProgram ? `${u.weeksGenerated}w · ${u.daysCompleted} days` : 'No plan'}</p>
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
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{displayName(u)}</p>
              <p style={{ fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{u.email}</p>
            </div>
            <RoleBadge role={u.role} />
            <span style={{ fontSize: 12, color: u.hasProgram ? C.green : C.textDim, fontWeight: u.hasProgram ? 700 : 400 }}>{u.hasProgram ? 'Active' : '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: u.weeksGenerated > 0 ? C.text : C.textDim }}>{u.weeksGenerated || '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: u.daysCompleted > 0 ? C.text : C.textDim }}>{u.daysCompleted || '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: u.exerciseLogs > 0 ? C.text : C.textDim }}>{u.exerciseLogs || '—'}</span>
            <span style={{ fontSize: 11, color: C.textDim }}>{u.lastActive ? fmtRelative(u.lastActive) : fmtDate(u.created_at)}</span>
            <span style={{ fontSize: 12, color: C.textDim }}>{fmtDate(u.created_at)}</span>
            {u.role === 'free' ? (
              <button onClick={() => onRoleChange(u.id, 'beta')} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                → Beta
              </button>
            ) : u.role === 'beta' ? (
              <button onClick={() => onRoleChange(u.id, 'free')} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textDim, fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                Revoke
              </button>
            ) : (
              <span style={{ fontSize: 11, color: C.textDim }}>Admin</span>
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
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[e.type] ?? C.textDim }} />
              {i < events.length - 1 && <div style={{ width: 1, height: 26, background: C.border, marginTop: 4 }} />}
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '3px 6px', borderRadius: 4, background: `${TYPE_COLOR[e.type]}18`, color: TYPE_COLOR[e.type] ?? C.textDim, border: `1px solid ${TYPE_COLOR[e.type]}30`, flexShrink: 0, marginTop: 1, minWidth: 36, textAlign: 'center' }}>
              {TYPE_LABEL[e.type] ?? '—'}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13 }}><strong style={{ fontWeight: 700 }}>{e.userName}</strong> — {e.detail}</p>
            </div>
            <span style={{ fontSize: 12, color: C.textDim, flexShrink: 0 }}>{fmtRelative(e.timestamp)}</span>
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
              {t.priority === 'high' && <span style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: '0.06em', textTransform: 'uppercase' }}>High</span>}
              <span style={{ fontSize: 11, color: C.textDim }}>{fmtDate(t.created_at)}</span>
              <button onClick={() => deleteTodo(t.id)} style={deleteBtnSt}>✕</button>
            </div>
          ))}
        </Panel>
      )}
      {active.length === 0 && <EmptyState msg="No active todos — you're clear." />}

      {done.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10, marginTop: 8 }}>Done ({done.length})</p>
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
            <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 76 }}>{idea.category}</span>
            <span style={{ flex: 1, fontSize: 13, color: C.text }}>{idea.content}</span>
            <span style={{ fontSize: 11, color: C.textDim, marginRight: 4 }}>{fmtDate(idea.created_at)}</span>
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
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE (e.g. BETA2026)" style={{ ...inputSt, flex: 2, minWidth: 160, letterSpacing: '0.08em' }} />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputSt, width: 120 }}>
          <option value="beta">Beta Access</option>
          <option value="admin">Admin</option>
        </select>
        <input value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Max uses (blank = 10)" type="number" style={{ ...inputSt, flex: 1, minWidth: 140 }} />
        <button onClick={addPromo} disabled={saving} style={addBtnSt}>Create</button>
      </div>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Each user can only redeem one code. Codes are case-insensitive.</p>

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
            <span style={{ fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace', fontSize: 14, color: C.accent }}>{p.code}</span>
            <RoleBadge role={p.role ?? 'beta'} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 4, background: C.surface2, borderRadius: 2, maxWidth: 140 }}>
                <div style={{ height: '100%', borderRadius: 2, background: C.accent, width: `${Math.min(((p.uses ?? 0) / (p.max_uses ?? 10)) * 100, 100)}%` }} />
              </div>
              <span style={{ fontSize: 12, color: C.textDim }}>{p.uses ?? 0} / {p.max_uses ?? '∞'}</span>
            </div>
            <span style={{ fontSize: 12, color: C.textDim }}>{fmtDate(p.created_at)}</span>
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
      <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <p style={{ fontWeight: 700, fontSize: 17, color: C.text }}>{label}</p>
      <p style={{ fontSize: 13, color: C.textDim, textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>This section is coming in the next build phase.</p>
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
]

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')

  // Data state
  const [users, setUsers] = useState<UserStat[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [todos, setTodos] = useState<TodoRow[]>([])
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [promos, setPromos] = useState<PromoRow[]>([])
  const [kpis, setKpis] = useState<{ label: string; value: string | number; sub: string; accent: string }[]>([])
  const [dataLoading, setDataLoading] = useState(true)

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
    return <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.textDim, fontSize: 14 }}>{authLoading ? 'Loading…' : 'Access denied'}</div>
  }

  const activeTodoCount = todos.filter(t => t.status === 'pending').length

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', zIndex: 50 }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: '100%' }}>

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
                  <button key={item.id} onClick={() => setTab(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, border: 'none', background: active ? C.accentDim : 'none', color: active ? C.accent : C.textMid, fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer', marginBottom: 2, textAlign: 'left', transition: 'all 0.1s', fontFamily: 'inherit' }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{ height: 56, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: C.surface, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{NAV_GROUPS.flatMap(g => g.items).find(i => i.id === tab)?.label}</span>
            {dataLoading && <span style={{ fontSize: 11, color: C.textDim }}>· loading…</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: C.accentDim, border: `1px solid ${C.accentBorder}`, color: C.accent, fontWeight: 700, letterSpacing: '0.06em' }}>ADMIN</span>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff' }}>
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 60px' }}>
          {tab === 'overview' && <OverviewTab users={users} events={events} kpis={kpis} />}
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
        </main>
      </div>
    </div>
  )
}
