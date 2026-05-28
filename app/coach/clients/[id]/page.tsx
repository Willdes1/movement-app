'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ClientProfile {
  id: string
  name: string | null
  role: string
  training_level: string | null
  sport: string | null
}

interface AssignmentRow {
  id: string
  program_id: string
  start_date: string
  status: string
  created_at: string
  program_name: string
  weeks_total: number
}

interface WorkoutStat {
  sessions_30d: number
  last_logged: string | null
}

const ASSIGN_STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active:    { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  completed: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  paused:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  cancelled: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

export default function CoachClientDetailPage() {
  const { user }   = useAuth()
  const router     = useRouter()
  const params     = useParams()
  const clientId   = params.id as string

  const [profile, setProfile]           = useState<ClientProfile | null>(null)
  const [assignments, setAssignments]   = useState<AssignmentRow[]>([])
  const [workoutStat, setWorkoutStat]   = useState<WorkoutStat | null>(null)
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)

  useEffect(() => { if (user && clientId) load() }, [user, clientId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)

    // Verify client is in this coach's roster
    const { data: roster } = await supabase
      .from('coach_clients')
      .select('id')
      .eq('coach_id', user!.id)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .maybeSingle()

    if (!roster) { setNotFound(true); setLoading(false); return }

    const [profRes, assignRes] = await Promise.all([
      supabase.from('profiles').select('id, name, role, training_level, sport').eq('id', clientId).single(),
      supabase.from('coach_program_assignments')
        .select('id, program_id, start_date, status, created_at, coach_programs(name, weeks_total)')
        .eq('coach_id', user!.id)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ])

    if (profRes.data) setProfile(profRes.data as ClientProfile)

    if (assignRes.data) {
      setAssignments((assignRes.data as any[]).map(a => ({
        id: a.id,
        program_id: a.program_id,
        start_date: a.start_date,
        status: a.status,
        created_at: a.created_at,
        program_name: (a.coach_programs as { name: string }[])?.[0]?.name ?? 'Program',
        weeks_total: (a.coach_programs as { weeks_total: number }[])?.[0]?.weeks_total ?? 0,
      })))
    }

    // Workout count (last 30 days) — best-effort; RLS may restrict this
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: logs, count } = await supabase
      .from('workout_logs')
      .select('logged_at', { count: 'exact' })
      .eq('user_id', clientId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: false })
      .limit(1)

    if (count !== null) {
      setWorkoutStat({
        sessions_30d: count,
        last_logged: (logs as { logged_at: string }[] | null)?.[0]?.logged_at ?? null,
      })
    }

    setLoading(false)
  }

  async function pauseAssignment(id: string) {
    await supabase.from('coach_program_assignments').update({ status: 'paused' }).eq('id', id).eq('coach_id', user!.id)
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: 'paused' } : a))
  }

  async function resumeAssignment(id: string) {
    await supabase.from('coach_program_assignments').update({ status: 'paused' }).eq('coach_id', user!.id).eq('client_id', clientId).eq('status', 'active')
    await supabase.from('coach_program_assignments').update({ status: 'active' }).eq('id', id).eq('coach_id', user!.id)
    setAssignments(prev => prev.map(a => ({
      ...a,
      status: a.id === id ? 'active' : a.status === 'active' ? 'paused' : a.status,
    })))
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function initials(name: string | null) {
    return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function weekProgress(startDate: string, total: number) {
    const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
    const week = Math.min(Math.max(Math.floor(days / 7) + 1, 1), total)
    return { week, pct: Math.round((week / total) * 100) }
  }

  if (loading) return (
    <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading…</div>
  )

  if (notFound) return (
    <div style={{ padding: '80px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Client not found</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>This client is not in your roster.</div>
      <button onClick={() => router.push('/coach/clients')} style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
        Back to Clients
      </button>
    </div>
  )

  const name         = profile?.name ?? 'Unknown Client'
  const activeAssign = assignments.find(a => a.status === 'active')
  const progress     = activeAssign ? weekProgress(activeAssign.start_date, activeAssign.weeks_total) : null

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1000 }}>
      {/* Back */}
      <button
        onClick={() => router.push('/coach/clients')}
        style={{ fontSize: 13, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 28 }}
      >
        ← Back to Clients
      </button>

      {/* Client header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>
          {initials(name)}
        </div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 8px' }}>{name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', textTransform: 'capitalize', fontWeight: 600 }}>
              {profile?.role ?? 'user'}
            </span>
            {profile?.training_level && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', textTransform: 'capitalize', fontWeight: 600 }}>
                {profile.training_level}
              </span>
            )}
            {profile?.sport && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontWeight: 600 }}>
                {profile.sport}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Active Program',     value: activeAssign ? activeAssign.program_name.split(' ').slice(0, 3).join(' ') + (activeAssign.program_name.split(' ').length > 3 ? '…' : '') : 'None', icon: '📋' },
          { label: 'Current Week',       value: progress ? `${progress.week} / ${activeAssign!.weeks_total}` : '—', icon: '📅' },
          { label: 'Workouts (30d)',      value: workoutStat !== null ? workoutStat.sessions_30d : '—', icon: '💪' },
          { label: 'Programs Assigned',  value: assignments.length, icon: '📦' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{card.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 2 }}>{String(card.value)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Active program progress */}
      {activeAssign && progress && (
        <div style={{ background: 'var(--surface2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14, padding: '22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Active Program</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{activeAssign.program_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                Started {fmtDate(activeAssign.start_date)} · {activeAssign.weeks_total} weeks total
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.push(`/coach/programs/${activeAssign.program_id}`)}
                style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                View Program
              </button>
              <button
                onClick={() => pauseAssignment(activeAssign.id)}
                style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Pause
              </button>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Week {progress.week} of {activeAssign.weeks_total}</span>
              <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>{progress.pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.pct}%`, background: '#22c55e', borderRadius: 4 }} />
            </div>
          </div>
        </div>
      )}

      {/* Assignment history */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          All Assignments ({assignments.length})
        </div>
        {assignments.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>No programs assigned yet.</div>
        ) : (
          <div>
            {assignments.map((a, i) => {
              const sc = ASSIGN_STATUS_COLOR[a.status] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < assignments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => router.push(`/coach/programs/${a.program_id}`)}
                      style={{ fontSize: 14, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', textAlign: 'left' }}
                    >
                      {a.program_name}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {a.weeks_total}w · starts {fmtDate(a.start_date)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 9px', borderRadius: 20, color: sc.color, background: sc.bg, flexShrink: 0 }}>
                    {a.status}
                  </span>
                  {a.status === 'paused' && (
                    <button
                      onClick={() => resumeAssignment(a.id)}
                      style={{ fontSize: 11, color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                    >
                      Resume
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {workoutStat === null && (
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
          Workout history visible once the client logs a session.
        </div>
      )}
    </div>
  )
}
