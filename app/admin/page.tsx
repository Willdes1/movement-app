'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'overview' | 'todos' | 'ideas' | 'promos' | 'users'

type TodoRow = { id: string; content: string; category: string; status: string; priority: string; created_at: string; updated_at: string }
type IdeaRow = { id: string; content: string; category: string; created_at: string }
type PromoRow = { id: string; code: string; role: string; max_uses: number; uses: number; created_at: string }
type UserRow = { id: string; email: string; full_name: string | null; role: string; is_admin: boolean; created_at: string }

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')

  const [todos, setTodos] = useState<TodoRow[]>([])
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [promos, setPromos] = useState<PromoRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [newTodo, setNewTodo] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState('medium')
  const [newTodoCategory, setNewTodoCategory] = useState('general')
  const [newIdea, setNewIdea] = useState('')
  const [newIdeaCategory, setNewIdeaCategory] = useState('General')
  const [newPromoCode, setNewPromoCode] = useState('')
  const [newPromoRole, setNewPromoRole] = useState('beta')
  const [newPromoUses, setNewPromoUses] = useState('')

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/today')
    }
  }, [loading, user, isAdmin, router])

  useEffect(() => {
    if (isAdmin) fetchAll()
  }, [isAdmin])

  async function fetchAll() {
    const [t, i, p, u] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('ideas').select('*').order('created_at', { ascending: false }),
      supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, role, is_admin, created_at').order('created_at', { ascending: false }),
    ])
    if (t.data) setTodos(t.data)
    if (i.data) setIdeas(i.data)
    if (p.data) setPromos(p.data)
    if (u.data) setUsers(u.data)
  }

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }

  async function addTodo() {
    if (!newTodo.trim()) return
    setSaving(true)
    await supabase.from('todos').insert({ content: newTodo.trim(), status: 'pending', priority: newTodoPriority, category: newTodoCategory })
    setNewTodo('')
    await fetchAll()
    flash('Todo added')
    setSaving(false)
  }

  async function toggleTodo(todo: TodoRow) {
    const next = todo.status === 'pending' ? 'done' : 'pending'
    await supabase.from('todos').update({ status: next, updated_at: new Date().toISOString() }).eq('id', todo.id)
    await fetchAll()
  }

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id)
    await fetchAll()
  }

  async function addIdea() {
    if (!newIdea.trim()) return
    setSaving(true)
    await supabase.from('ideas').insert({ content: newIdea.trim(), category: newIdeaCategory })
    setNewIdea('')
    await fetchAll()
    flash('Idea saved')
    setSaving(false)
  }

  async function deleteIdea(id: string) {
    await supabase.from('ideas').delete().eq('id', id)
    await fetchAll()
  }

  async function addPromo() {
    if (!newPromoCode.trim()) return
    setSaving(true)
    await supabase.from('promo_codes').insert({
      code: newPromoCode.trim().toUpperCase(),
      role: newPromoRole,
      max_uses: newPromoUses ? parseInt(newPromoUses) : 10,
    })
    setNewPromoCode('')
    setNewPromoUses('')
    await fetchAll()
    flash('Promo code created')
    setSaving(false)
  }

  async function deletePromo(id: string) {
    await supabase.from('promo_codes').delete().eq('id', id)
    await fetchAll()
  }

  if (loading || !isAdmin) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)' }}>
        {loading ? 'Loading…' : 'Access denied'}
      </div>
    )
  }

  const activeTodos = todos.filter(t => t.status === 'pending')
  const doneTodos = todos.filter(t => t.status === 'done')
  const totalUsers = users.length
  const betaUsers = users.filter(u => u.role === 'beta').length

  return (
    <div style={{ padding: '24px 20px 100px', maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
          Admin Panel
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 0 }}>
          Command Center
        </h1>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ padding: '10px 14px', background: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.3)', borderRadius: 8, fontSize: 13, color: '#4ec97a', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 2 }}>
        {(['overview', 'todos', 'ideas', 'promos', 'users'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: tab === t ? 'var(--accent)' : 'var(--surface2)',
              color: tab === t ? '#fff' : 'var(--text-mid)',
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {t === 'todos' ? `Todos (${activeTodos.length})` :
             t === 'ideas' ? `Ideas (${ideas.length})` :
             t === 'promos' ? `Promos (${promos.length})` :
             t === 'users' ? `Users (${totalUsers})` :
             'Overview'}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Total Users', value: totalUsers, sub: `${betaUsers} beta` },
            { label: 'Active Todos', value: activeTodos.length, sub: `${doneTodos.length} done` },
            { label: 'Ideas Logged', value: ideas.length, sub: 'in backlog' },
            { label: 'Promo Codes', value: promos.length, sub: 'created' },
          ].map(card => (
            <div key={card.label} style={{ padding: '20px 18px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>{card.label}</p>
              <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2 }}>{card.value}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* TODOS */}
      {tab === 'todos' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTodo()}
              placeholder="Add a new todo…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <select value={newTodoPriority} onChange={e => setNewTodoPriority(e.target.value)} style={{ ...inputStyle, width: 100 }}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button onClick={addTodo} disabled={saving} style={addBtnStyle}>Add</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Press Enter or tap Add.</p>

          <p style={sectionLabel}>Active ({activeTodos.length})</p>
          {activeTodos.length === 0 && <p style={emptyStyle}>No active todos</p>}
          {activeTodos.map(todo => (
            <div key={todo.id} style={rowStyle}>
              <button onClick={() => toggleTodo(todo)} style={checkStyle(false)}>○</button>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14 }}>{todo.content}</span>
                {todo.priority === 'high' && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>High</span>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 8 }}>{fmtDate(todo.created_at)}</span>
              <button onClick={() => deleteTodo(todo.id)} style={deleteBtn}>✕</button>
            </div>
          ))}

          {doneTodos.length > 0 && (
            <>
              <p style={{ ...sectionLabel, marginTop: 24 }}>Done ({doneTodos.length})</p>
              {doneTodos.map(todo => (
                <div key={todo.id} style={{ ...rowStyle, opacity: 0.5 }}>
                  <button onClick={() => toggleTodo(todo)} style={checkStyle(true)}>✓</button>
                  <span style={{ flex: 1, fontSize: 14, textDecoration: 'line-through' }}>{todo.content}</span>
                  <button onClick={() => deleteTodo(todo.id)} style={deleteBtn}>✕</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* IDEAS */}
      {tab === 'ideas' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              value={newIdea}
              onChange={e => setNewIdea(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIdea()}
              placeholder="Capture an idea…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <select value={newIdeaCategory} onChange={e => setNewIdeaCategory(e.target.value)} style={{ ...inputStyle, width: 120 }}>
              {['General', 'Billing', 'UI/UX', 'Features', 'Marketing', 'Analytics'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button onClick={addIdea} disabled={saving} style={addBtnStyle}>Save</button>
          </div>

          {ideas.length === 0 && <p style={emptyStyle}>No ideas yet</p>}
          {ideas.map(idea => (
            <div key={idea.id} style={rowStyle}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 72 }}>{idea.category}</span>
              <span style={{ flex: 1, fontSize: 14, marginLeft: 10 }}>{idea.content}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 8 }}>{fmtDate(idea.created_at)}</span>
              <button onClick={() => deleteIdea(idea.id)} style={deleteBtn}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* PROMOS */}
      {tab === 'promos' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              value={newPromoCode}
              onChange={e => setNewPromoCode(e.target.value.toUpperCase())}
              placeholder="CODE (e.g. BETA2026)"
              style={{ ...inputStyle, flex: 2, letterSpacing: '0.08em' }}
            />
            <select value={newPromoRole} onChange={e => setNewPromoRole(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="beta">Beta Access</option>
              <option value="admin">Admin</option>
            </select>
            <input
              value={newPromoUses}
              onChange={e => setNewPromoUses(e.target.value)}
              placeholder="Max uses (blank = 10)"
              type="number"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addPromo} disabled={saving} style={addBtnStyle}>Create</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
            Each user can only redeem one code. Codes are case-insensitive.
          </p>

          {promos.length === 0 && <p style={emptyStyle}>No promo codes yet</p>}
          {promos.map(promo => (
            <div key={promo.id} style={rowStyle}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', minWidth: 110 }}>{promo.code}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginRight: 8,
                background: promo.role === 'beta' ? 'rgba(78,201,122,0.1)' : 'rgba(255,150,50,0.1)',
                color: promo.role === 'beta' ? 'var(--green)' : 'var(--orange)',
              }}>{promo.role.toUpperCase()}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)' }}>
                {promo.uses} / {promo.max_uses} used
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 8 }}>{fmtDate(promo.created_at)}</span>
              <button onClick={() => deletePromo(promo.id)} style={deleteBtn}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
            {totalUsers} total · {betaUsers} beta · {totalUsers - betaUsers} free
          </p>
          {users.length === 0 && <p style={emptyStyle}>No users yet</p>}
          {users.map(u => (
            <div key={u.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{u.email ?? u.full_name ?? 'Unknown'}</p>
                {u.full_name && <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{u.full_name}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: u.role === 'beta' ? 'rgba(78,201,122,0.1)' : u.role === 'admin' ? 'rgba(255,150,50,0.1)' : 'var(--surface2)',
                  color: u.role === 'beta' ? 'var(--green)' : u.role === 'admin' ? 'var(--orange)' : 'var(--text-dim)',
                }}>
                  {u.role ?? 'free'}
                </span>
                {u.is_admin && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#FFD700', letterSpacing: '0.06em' }}>ADMIN</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtDate(u.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const addBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  marginBottom: 8,
  gap: 8,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 10,
}

const emptyStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-dim)',
  padding: '20px 0',
  textAlign: 'center',
}

const deleteBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 13,
  padding: '2px 6px',
  borderRadius: 4,
}

function checkStyle(done: boolean): React.CSSProperties {
  return {
    background: done ? 'var(--accent)' : 'none',
    border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 6,
    color: done ? '#fff' : 'var(--text-dim)',
    cursor: 'pointer',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    flexShrink: 0,
  }
}
