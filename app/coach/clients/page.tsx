'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Assignment {
  id: string
  program_id: string
  start_date: string
  status: string
  created_at: string
  coach_programs: { name: string; weeks_total: number } | null
}

interface ClientRow {
  id: string           // coach_clients.id
  client_id: string
  status: string
  created_at: string
  profile: { name: string | null; role: string } | null
  assignments: Assignment[]
}

const ASSIGN_STATUS_COLOR: Record<string, string> = {
  active:    '#22c55e',
  completed: '#3b82f6',
  paused:    '#f59e0b',
  cancelled: '#6b7280',
}

export default function CoachClientsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    fetchClients()
  }, [user])

  async function fetchClients() {
    setLoading(true)

    // Fetch coach_clients with profile data
    const { data: rosterData, error: rosterErr } = await supabase
      .from('coach_clients')
      .select('id, client_id, status, created_at')
      .eq('coach_id', user!.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (rosterErr) { setError(rosterErr.message); setLoading(false); return }
    if (!rosterData || rosterData.length === 0) { setClients([]); setLoading(false); return }

    const clientIds = rosterData.map(r => r.client_id)

    // Fetch profiles for those clients
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, role')
      .in('id', clientIds)

    // Fetch assignments for those clients
    const { data: assignmentData } = await supabase
      .from('coach_program_assignments')
      .select('id, program_id, client_id, start_date, status, created_at, coach_programs(name, weeks_total)')
      .eq('coach_id', user!.id)
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })

    const profileMap = new Map((profileData ?? []).map(p => [p.id, p]))
    const assignmentsByClient = new Map<string, Assignment[]>()
    ;(assignmentData ?? []).forEach((a) => {
      const arr = assignmentsByClient.get(a.client_id) ?? []
      arr.push(a as Assignment)
      assignmentsByClient.set(a.client_id, arr)
    })

    const rows: ClientRow[] = rosterData.map(r => ({
      id: r.id,
      client_id: r.client_id,
      status: r.status,
      created_at: r.created_at,
      profile: profileMap.get(r.client_id) ?? null,
      assignments: assignmentsByClient.get(r.client_id) ?? [],
    }))

    setClients(rows)
    setLoading(false)
  }

  async function removeClient(coachClientId: string) {
    if (!confirm('Remove this client from your roster? Their assignment history will be kept.')) return
    const { error } = await supabase
      .from('coach_clients')
      .update({ status: 'inactive' })
      .eq('id', coachClientId)
      .eq('coach_id', user!.id)
    if (error) setError(error.message)
    else setClients(prev => prev.filter(c => c.id !== coachClientId))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Coach Portal
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Clients</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 6 }}>
            {clients.length} active client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/coach/programs')}
          style={{ padding: '11px 22px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
        >
          Assign a Program
        </button>
      </div>

      {error && (
        <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-dim)', fontSize: 14 }}>Loading clients…</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No clients yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
            Assign a program to a user to add them to your roster
          </div>
          <button
            onClick={() => router.push('/coach/programs')}
            style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Go to Programs
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {clients.map(client => {
            const name = client.profile?.name ?? 'Unknown User'
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            const activeAssignment = client.assignments.find(a => a.status === 'active')
            return (
              <div
                key={client.id}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}
              >
                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)20', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
                      {client.profile?.role ?? 'user'}
                    </span>
                  </div>

                  {/* Assignments */}
                  {client.assignments.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No programs assigned</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                      {client.assignments.slice(0, 3).map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: ASSIGN_STATUS_COLOR[a.status] ?? '#6b7280', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                            {a.coach_programs?.name ?? 'Program'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {a.coach_programs?.weeks_total}w · starts {formatDate(a.start_date)}
                          </span>
                          <span style={{ fontSize: 10, color: ASSIGN_STATUS_COLOR[a.status] ?? '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                      {client.assignments.length > 3 && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>+{client.assignments.length - 3} more</div>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Added {formatDate(client.created_at)}</div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                  {activeAssignment && (
                    <button
                      onClick={() => router.push(`/coach/programs/${activeAssignment.program_id}`)}
                      style={{ padding: '7px 14px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                    >
                      View Program
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/coach/programs')}
                    style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    + Assign
                  </button>
                  <button
                    onClick={() => removeClient(client.id)}
                    style={{ padding: '7px 12px', background: 'transparent', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
