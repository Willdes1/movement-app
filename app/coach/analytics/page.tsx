'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ClientStat {
  id: string
  name: string
  training_level: string | null
  program_name: string | null
  current_week: number | null
  weeks_total: number | null
  start_date: string | null
  workouts_7d: number
  workouts_30d: number
  last_workout: string | null
}

interface Summary {
  total: number
  avgWorkouts30d: number
  inactive: number
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function activityColor(workouts7d: number, lastWorkout: string | null): { color: string; bg: string; label: string } {
  const daysSince = lastWorkout
    ? Math.floor((Date.now() - new Date(lastWorkout).getTime()) / 86_400_000)
    : 999

  if (workouts7d >= 3)  return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Active' }
  if (workouts7d >= 1)  return { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Training' }
  if (daysSince <= 10)  return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Slowing' }
  return                       { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Inactive' }
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function CoachAnalyticsPage() {
  const { user }  = useAuth()
  const router    = useRouter()
  const [clients, setClients]   = useState<ClientStat[]>([])
  const [summary, setSummary]   = useState<Summary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [sort, setSort]         = useState<'activity' | 'name' | 'program'>('activity')

  useEffect(() => { if (user) load() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const res = await fetch('/api/coach/analytics', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to load'); setLoading(false); return }

    setClients(data.clients ?? [])
    setSummary(data.summary ?? null)
    setLoading(false)
  }

  const sorted = [...clients].sort((a, b) => {
    if (sort === 'name')     return a.name.localeCompare(b.name)
    if (sort === 'program')  return (a.program_name ?? '').localeCompare(b.program_name ?? '')
    // activity: sort by last_workout desc (already default from API)
    if (!a.last_workout && !b.last_workout) return 0
    if (!a.last_workout) return 1
    if (!b.last_workout) return -1
    return b.last_workout.localeCompare(a.last_workout)
  })

  const inactive = clients.filter(c => c.workouts_7d === 0).length

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Coach Portal
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 6 }}>Client activity and workout compliance</p>
        </div>
        <button
          onClick={load}
          style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ↺ Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Active Clients',    value: loading ? '…' : (summary?.total ?? 0),          icon: '👥', color: 'var(--text)' },
          { label: 'Avg Workouts / Mo', value: loading ? '…' : (summary?.avgWorkouts30d ?? 0), icon: '📈', color: '#22c55e' },
          { label: 'Inactive (7d)',     value: loading ? '…' : inactive,                       icon: '⚠️', color: inactive > 0 ? '#ef4444' : '#22c55e' },
          { label: 'On a Program',      value: loading ? '…' : clients.filter(c => c.program_name).length, icon: '📋', color: 'var(--accent)' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: card.color, marginBottom: 2 }}>{String(card.value)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Client table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 14 }}>Loading client data…</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 40px', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No clients yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
            Share your invite code from the Dashboard to get clients on your roster.
          </div>
          <button onClick={() => router.push('/coach/dashboard')} style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Get Invite Code
          </button>
        </div>
      ) : (
        <>
          {/* Sort controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sort:</span>
            {(['activity', 'name', 'program'] as const).map(s => (
              <button key={s} onClick={() => setSort(s)} style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${sort === s ? 'var(--accent-border, rgba(59,130,246,0.3))' : 'var(--border)'}`, background: sort === s ? 'rgba(59,130,246,0.1)' : 'transparent', color: sort === s ? 'var(--accent)' : 'var(--text-dim)', fontSize: 12, fontWeight: sort === s ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit' }}>
                {s}
              </button>
            ))}
          </div>

          {/* Inactive alert banner */}
          {inactive > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              ⚠️ {inactive} client{inactive !== 1 ? 's have' : ' has'} not logged a workout in 7+ days. Consider reaching out.
            </div>
          )}

          {/* Client rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map(client => {
              const activity = activityColor(client.workouts_7d, client.last_workout)
              const progress = client.current_week && client.weeks_total
                ? Math.round((client.current_week / client.weeks_total) * 100)
                : null

              return (
                <div
                  key={client.id}
                  onClick={() => router.push(`/coach/clients/${client.id}`)}
                  style={{ background: 'var(--surface2)', border: `1px solid var(--border)`, borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    {/* Avatar + status */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${activity.bg}`, border: `2px solid ${activity.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: activity.color }}>
                        {initials(client.name)}
                      </div>
                    </div>

                    {/* Client info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{client.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: activity.bg, color: activity.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {activity.label}
                        </span>
                        {client.training_level && (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                            {client.training_level}
                          </span>
                        )}
                      </div>

                      {/* Program + progress */}
                      {client.program_name ? (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                            {client.program_name}
                            {client.current_week && client.weeks_total && (
                              <span style={{ marginLeft: 6 }}>· Week {client.current_week}/{client.weeks_total}</span>
                            )}
                          </div>
                          {progress !== null && (
                            <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
                              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2 }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>No active program</div>
                      )}
                    </div>

                    {/* Workout stats */}
                    <div style={{ display: 'flex', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: client.workouts_7d > 0 ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
                          {client.workouts_7d}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>Last 7d</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontFamily: 'monospace' }}>
                          {client.workouts_30d}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>Last 30d</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)' }}>
                          {timeAgo(client.last_workout)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>Last workout</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
