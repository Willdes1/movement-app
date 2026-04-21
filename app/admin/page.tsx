'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'overview' | 'todos' | 'ideas' | 'promos' | 'users'

type TodoRow = { id: string; text: string; status: string; created_at: string; updated_at: string }
type IdeaRow = { id: string; text: string; category: string; created_at: string }
type PromoRow = { id: string; code: string; grants_tier: string; max_uses: number | null; uses_count: number; active: boolean; created_at: string }
type UserRow = { id: string; email: string; full_name: string | null; plan_tier: string; is_admin: boolean; created_at: string }

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')

  const [todos, setTodos] = useState<TodoRow[]>([])
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [promos, setPromos] = useState<PromoRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [newTodo, setNewTodo] = useState('')
  const [newIdea, setNewIdea] = useState('')
  const [newIdeaCategory, setNewIdeaCategory] = useState('General')
  const [newPromoCode, setNewPromoCode] = useState('')
  const [newPromoTier, setNewPromoTier] = useState('pro')
  const [newPromoMax, setNewPromoMax] = useState('')

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/today')
    }
  }, [loading, user, isAdmin, router])

  useEffect(() => {
    if (isAdmin) {
      fetchAll()
    }
  }, [isAdmin])

  async function fetchAll() {
    const [t, i, p, u] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('ideas').select('*').order('created_at', { ascending: false }),
      supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, plan_tier, is_admin, created_at').order('created_at', { ascending: false }),
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
    await supabase.from('todos').insert({ text: newTodo.trim(), status: 'active' })
    setNewTodo('')
    await fetchAll()
    flash('Todo added')
    setSaving(false)
  }

  async function toggleTodo(todo: TodoRow) {
    const next = todo.status === 'active' ? 'done' : 'active'
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
    await supabase.from('ideas').insert({ text: newIdea.trim(), category: newIdeaCategory })
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
      grants_tier: newPromoTier,
      max_uses: newPromoMax ? parseInt(newPromoMax) : null,
      uses_count: 0,
      active: true,
    })
    setNewPromoCode('')
    setNewPromoMax('')
    await fetchAll()
    flash('Promo code created')
    setSaving(false)
  }

  async function togglePromo(promo: PromoRow) {
    await supabase.from('promo_codes').update({ active: !promo.active }).eq('id', promo.id)
    await fetchAll()
  }

  if (loading || !isAdmin) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)' }}>
        {loading ? 'Loading…' : 'Access denied'}
      </div>
    )
  }

  const activeTodos = todos.filter(t => t.status === 'active')
  const doneTodos = todos.filter(t => t.status === 'done')
  const totalUsers = users.length
  const proUsers = users.filter(u => u.plan_tier === 'pro').length
  const activePromos = promos.filter(p => p.active).length

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
             t === 'promos' ? `Promos (${activePromos})` :
             t === 'users' ? `Users (${totalUsers})` :
             'Overview'}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Total Users', value: totalUsers, sub: `${proUsers} pro` },
            { label: 'Active Todos', value: activeTodos.length, sub: `${doneTodos.length} done` },
            { label: 'Ideas Logged', value: ideas.length, sub: 'in backlog' },
            { label: 'Active Promos', value: activePromos, sub: `${promos.length} total` },
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTodo()}
              placeholder="Add a new todo…"
              style={inputStyle}
            />
            <button onClick={addTodo} disabled={saving} style={addBtnStyle}>Add</button>
          </div>

          <p style={sectionLabel}>Active ({activeTodos.length})</p>
          {activeTodos.length === 0 && <p style={emptyStyle}>No active todos</p>}
          {activeTodos.map(todo => (
            <div key={todo.id} style={rowStyle}>
              <button onClick={() => toggleTodo(todo)} style={checkStyle(false)}>○</button>
              <span style={{ flex: 1, fontSize: 14 }}>{todo.text}</span>
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
                  <span style={{ flex: 1, fontSize: 14, textDecoration: 'line-through' }}>{todo.text}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newIdea}
                onChange={e => setNewIdea(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addIdea()}
                placeholder="Capture an idea…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={newIdeaCategory}
                onChange={e => setNewIdeaCategory(e.target.value)}
                style={{ ...inputStyle, width: 120 }}
              >
                {['General', 'Billing', 'UI/UX', 'Features', 'Marketing', 'Analytics'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button onClick={addIdea} disabled={saving} style={addBtnStyle}>Add</button>
            </div>
          </div>

          {ideas.length === 0 && <p style={emptyStyle}>No ideas yet</p>}
          {ideas.map(idea => (
            <div key={idea.id} style={rowStyle}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 72 }}>{idea.category}</span>
              <span style={{ flex: 1, fontSize: 14, marginLeft: 10 }}>{idea.text}</span>
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
              placeholder="CODE"
              style={{ ...inputStyle, width: 120, letterSpacing: '0.08em' }}
            />
            <select value={newPromoTier} onChange={e => setNewPromoTier(e.target.value)} style={{ ...inputStyle, width: 100 }}>
              <option value="pro">Pro</option>
              <option value="free">Free</option>
            </select>
            <input
              value={newPromoMax}
              onChange={e => setNewPromoMax(e.target.value)}
              placeholder="Max uses (blank = ∞)"
              type="number"
              style={{ ...inputStyle, width: 160 }}
            />
            <button onClick={addPromo} disabled={saving} style={addBtnStyle}>Create</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>Leave max uses blank for unlimited.</p>

          {promos.length === 0 && <p style={emptyStyle}>No promo codes yet</p>}
          {promos.map(promo => (
            <div key={promo.id} style={{ ...rowStyle, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', minWidth: 100 }}>{promo.code}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 40 }}>{promo.grants_tier}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1 }}>
                {promo.uses_count}{promo.max_uses ? `/${promo.max_uses}` : ''} uses
              </span>
              <button
                onClick={() => togglePromo(promo)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: promo.active ? 'rgba(80,200,120,0.12)' : 'var(--surface2)',
                  color: promo.active ? '#4ec97a' : 'var(--text-dim)',
                }}
              >
                {promo.active ? 'Active' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
            {totalUsers} total · {proUsers} pro · {totalUsers - proUsers} free
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
                  background: u.plan_tier === 'pro' ? 'rgba(255,92,53,0.12)' : 'var(--surface2)',
                  color: u.plan_tier === 'pro' ? 'var(--accent)' : 'var(--text-dim)',
                }}>
                  {u.plan_tier ?? 'free'}
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
