'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Assignment {
  id: string
  program_id: string
  client_id: string
  start_date: string
  status: string
  created_at: string
  coach_programs: { name: string; weeks_total: number }[] | null
}

interface ClientRow {
  id: string
  client_id: string
  status: string
  created_at: string
  profile: { name: string | null; role: string } | null
  assignments: Assignment[]
}

interface Program { id: string; name: string; weeks_total: number; status: string }

const ASSIGN_STATUS_COLOR: Record<string, string> = {
  active: '#22c55e', completed: '#3b82f6', paused: '#f59e0b', cancelled: '#6b7280',
}

export default function CoachClientsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [clients, setClients]   = useState<ClientRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Assign modal state
  const [assignTarget, setAssignTarget] = useState<ClientRow | null>(null)
  const [programs, setPrograms]         = useState<Program[]>([])
  const [progLoading, setProgLoading]   = useState(false)
  const [selProgramId, setSelProgramId] = useState('')
  const [startDate, setStartDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning]       = useState(false)
  const [assignError, setAssignError]   = useState('')

  useEffect(() => { if (user) fetchClients() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchClients() {
    setLoading(true)
    const { data: rosterData, error: rosterErr } = await supabase
      .from('coach_clients')
      .select('id, client_id, status, created_at')
      .eq('coach_id', user!.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (rosterErr) { setError(rosterErr.message); setLoading(false); return }
    if (!rosterData?.length) { setClients([]); setLoading(false); return }

    const clientIds = rosterData.map(r => r.client_id)
    const [profileRes, assignRes] = await Promise.all([
      supabase.from('profiles').select('id, name, role').in('id', clientIds),
      supabase.from('coach_program_assignments')
        .select('id, program_id, client_id, start_date, status, created_at, coach_programs(name, weeks_total)')
        .eq('coach_id', user!.id)
        .in('client_id', clientIds)
        .order('created_at', { ascending: false }),
    ])

    const profileMap  = new Map((profileRes.data ?? []).map((p: any) => [p.id, p]))
    const assignMap   = new Map<string, Assignment[]>()
    ;(assignRes.data ?? []).forEach((a: any) => {
      const arr = assignMap.get(a.client_id) ?? []
      arr.push(a as Assignment)
      assignMap.set(a.client_id, arr)
    })

    setClients(rosterData.map(r => ({
      id: r.id, client_id: r.client_id, status: r.status, created_at: r.created_at,
      profile: profileMap.get(r.client_id) ?? null,
      assignments: assignMap.get(r.client_id) ?? [],
    })))
    setLoading(false)
  }

  async function openAssignModal(client: ClientRow) {
    setAssignTarget(client)
    setSelProgramId('')
    setStartDate(new Date().toISOString().slice(0, 10))
    setAssignError('')
    setProgLoading(true)
    const { data } = await supabase
      .from('coach_programs')
      .select('id, name, weeks_total, status')
      .eq('coach_id', user!.id)
      .not('status', 'eq', 'archived')
      .order('created_at', { ascending: false })
    setPrograms((data ?? []) as Program[])
    setProgLoading(false)
  }

  async function confirmAssign() {
    if (!assignTarget || !selProgramId) return
    setAssigning(true)
    setAssignError('')

    // Pause any existing active assignment for this client
    await supabase.from('coach_program_assignments')
      .update({ status: 'paused' })
      .eq('coach_id', user!.id)
      .eq('client_id', assignTarget.client_id)
      .eq('status', 'active')

    const { error } = await supabase.from('coach_program_assignments').insert({
      coach_id:   user!.id,
      program_id: selProgramId,
      client_id:  assignTarget.client_id,
      start_date: startDate,
      status:     'active',
    })

    if (error) { setAssignError(error.message); setAssigning(false); return }

    setAssignTarget(null)
    setAssigning(false)
    await fetchClients()
  }

  async function removeClient(coachClientId: string) {
    if (!confirm('Remove this client from your roster? Their assignment history will be kept.')) return
    await supabase.from('coach_clients').update({ status: 'inactive' }).eq('id', coachClientId).eq('coach_id', user!.id)
    setClients(prev => prev.filter(c => c.id !== coachClientId))
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function initials(name: string) {
    return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const modalProgram = programs.find(p => p.id === selProgramId)

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      {/* Header */}
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
            Share your invite code from the Dashboard with clients. They enter it in their Account page.
          </div>
          <button
            onClick={() => router.push('/coach/dashboard')}
            style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Get Invite Code
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {clients.map(client => {
            const name           = client.profile?.name ?? 'Unknown User'
            const activeAssign   = client.assignments.find(a => a.status === 'active')
            return (
              <div key={client.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div
                  onClick={() => router.push(`/coach/clients/${client.client_id}`)}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0, cursor: 'pointer' }}
                >
                  {initials(name)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => router.push(`/coach/clients/${client.client_id}`)}
                      style={{ fontSize: 15, fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)' }}
                    >
                      {name}
                    </button>
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
                            {a.coach_programs?.[0]?.name ?? 'Program'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {a.coach_programs?.[0]?.weeks_total}w · starts {fmtDate(a.start_date)}
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
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Added {fmtDate(client.created_at)}</div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                  {activeAssign && (
                    <button
                      onClick={() => router.push(`/coach/programs/${activeAssign.program_id}`)}
                      style={{ padding: '7px 14px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      View Program
                    </button>
                  )}
                  <button
                    onClick={() => openAssignModal(client)}
                    style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    + Assign
                  </button>
                  <button
                    onClick={() => removeClient(client.id)}
                    style={{ padding: '7px 12px', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assign Program Modal */}
      {assignTarget && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setAssignTarget(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 480 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
              Assign Program
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
              Assigning to <strong style={{ color: 'var(--text)' }}>{assignTarget.profile?.name ?? 'client'}</strong>
            </div>

            {progLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>Loading programs…</div>
            ) : programs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>You don't have any programs yet.</div>
                <button onClick={() => router.push('/coach/builder')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Build a Program
                </button>
              </div>
            ) : (
              <>
                {/* Program picker */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Program
                  </label>
                  <select
                    value={selProgramId}
                    onChange={e => setSelProgramId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
                  >
                    <option value="">Select a program…</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.weeks_total}w)</option>
                    ))}
                  </select>
                </div>

                {/* Start date */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Summary */}
                {modalProgram && (
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13 }}>
                    <strong>{modalProgram.name}</strong>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                      {modalProgram.weeks_total} weeks · starts {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                {assignError && (
                  <div style={{ background: '#ef444420', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '10px 12px', color: '#ef4444', fontSize: 12, marginBottom: 14 }}>
                    {assignError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setAssignTarget(null)}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAssign}
                    disabled={!selProgramId || assigning}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: !selProgramId || assigning ? 'var(--surface2)' : 'var(--accent)', color: !selProgramId || assigning ? 'var(--text-dim)' : '#fff', fontWeight: 700, fontSize: 14, cursor: !selProgramId || assigning ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigning ? 'Assigning…' : 'Assign Program'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
