'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { reverseImpersonationAction } from '@/lib/impersonation-logger'
import { useAuth } from '@/contexts/AuthContext'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444',
  purple: '#a78bfa', text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Session = {
  id: string
  admin_id: string
  target_user_id: string
  started_at: string
  ended_at: string | null
  duration_chosen: number
  reason: string | null
  ended_by: string | null
}

type Action = {
  id: string
  session_id: string
  table_name: string
  row_id: string
  operation: 'insert' | 'update' | 'delete'
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reversed_at: string | null
  created_at: string
}

type UserStat = { id: string; email: string; name: string | null; full_name: string | null }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtDuration(ms: number) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

function opColor(op: string) {
  if (op === 'insert') return C.green
  if (op === 'delete') return C.red
  return C.amber
}

export default function ImpersonationActivityTab({ users }: { users: UserStat[] }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actions, setActions] = useState<Record<string, Action[]>>({})
  const [reversing, setReversing] = useState<string | null>(null)
  const [reverseMsg, setReverseMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const userMap = new Map(users.map(u => [u.id, u.name ?? u.full_name ?? u.email]))

  const loadSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('admin_impersonation_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)
    setSessions(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  async function loadActions(sessionId: string) {
    if (actions[sessionId]) return
    const { data } = await supabase
      .from('admin_impersonation_actions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setActions(prev => ({ ...prev, [sessionId]: data ?? [] }))
  }

  function toggleSession(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadActions(id)
    }
  }

  async function handleReverse(action: Action) {
    if (!user) return
    setReversing(action.id)
    const result = await reverseImpersonationAction({ actionId: action.id, adminId: user.id })
    setReverseMsg(prev => ({ ...prev, [action.id]: result.message }))
    if (result.success) {
      // Refresh the action list for this session
      const { data } = await supabase
        .from('admin_impersonation_actions')
        .select('*')
        .eq('session_id', action.session_id)
        .order('created_at', { ascending: true })
      setActions(prev => ({ ...prev, [action.session_id]: data ?? [] }))
    }
    setReversing(null)
  }

  if (loading) {
    return <p style={{ color: C.textDim, fontSize: 13, padding: 24 }}>Loading…</p>
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Zoom Log</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>
          Every impersonation session — who, when, how long, and every write made. Click a session to expand actions. Reverse any write within 30 days.
        </p>
      </div>

      {sessions.length === 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
          No sessions recorded yet. Zoom In on a user to start.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map(s => {
          const targetName = userMap.get(s.target_user_id) ?? s.target_user_id.slice(0, 8) + '…'
          const adminName = userMap.get(s.admin_id) ?? 'Admin'
          const duration = s.ended_at
            ? fmtDuration(new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())
            : 'Active'
          const isOpen = expandedId === s.id
          const sessionActions = actions[s.id] ?? []

          return (
            <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Session header */}
              <button
                onClick={() => toggleSession(s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', color: C.text,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: s.ended_at ? C.textDim : C.green,
                  boxShadow: s.ended_at ? 'none' : `0 0 6px ${C.green}`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{targetName}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: C.red, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                      {duration}
                    </span>
                    {s.reason && (
                      <span style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>"{s.reason}"</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, fontFamily: 'monospace' }}>
                    {fmtDate(s.started_at)} · by {adminName}
                    {s.ended_by && ` · ${s.ended_by.replace('_', ' ')}`}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Actions list */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {sessionActions.length === 0 && (
                    <p style={{ fontSize: 12, color: C.textDim, padding: '16px 20px', fontFamily: 'monospace' }}>
                      No writes logged during this session.
                    </p>
                  )}
                  {sessionActions.map((a, i) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 20px',
                        borderBottom: i < sessionActions.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: a.reversed_at ? 'rgba(34,197,94,0.04)' : 'transparent',
                      }}
                    >
                      <div style={{
                        padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        fontFamily: 'monospace', flexShrink: 0, marginTop: 1,
                        background: `${opColor(a.operation)}18`, color: opColor(a.operation),
                        border: `1px solid ${opColor(a.operation)}35`,
                      }}>
                        {a.operation}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>
                          {a.table_name}
                          <span style={{ color: C.textDim, fontWeight: 400 }}> / </span>
                          <span style={{ color: C.accent }}>{a.row_id.slice(0, 12)}…</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          {fmtDate(a.created_at)}
                          {a.reversed_at && (
                            <span style={{ color: C.green, marginLeft: 8 }}>✓ Reversed {fmtDate(a.reversed_at)}</span>
                          )}
                        </div>
                        {reverseMsg[a.id] && (
                          <div style={{ fontSize: 11, marginTop: 4, color: reverseMsg[a.id].includes('success') || reverseMsg[a.id].toLowerCase().startsWith('reversed') ? C.green : C.red }}>
                            {reverseMsg[a.id]}
                          </div>
                        )}
                      </div>
                      {!a.reversed_at && (
                        <button
                          onClick={() => handleReverse(a)}
                          disabled={reversing === a.id}
                          style={{
                            padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                            border: `1px solid ${C.amber}40`, background: `${C.amber}12`,
                            color: C.amber, cursor: reversing === a.id ? 'not-allowed' : 'pointer',
                            flexShrink: 0, opacity: reversing === a.id ? 0.5 : 1,
                            fontFamily: 'monospace',
                          }}
                        >
                          {reversing === a.id ? '…' : '↩ Reverse'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
