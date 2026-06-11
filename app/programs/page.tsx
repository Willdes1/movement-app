'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'
import { supabase } from '@/lib/supabase'

type Program = {
  id: string
  start_date: string
  created_at: string
  week_count: number
  is_current: boolean
}

type SharedProgram = {
  id: string
  name: string
  weeks_total: number
  shared_with_roles: string[]
  already_activated: boolean
}

function getPhase(week: number) {
  if (week <= 4) return 'Foundation'
  if (week <= 8) return 'Build'
  if (week <= 10) return 'Peak'
  return 'Maintenance'
}

function programLabel(prog: Program) {
  const start = new Date(prog.start_date)
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Program'
}

function programRange(prog: Program) {
  const start = new Date(prog.start_date)
  const end = new Date(start)
  end.setDate(end.getDate() + prog.week_count * 7 - 1)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ProgramsPage() {
  const { user, loading: authLoading, effectiveUserId, role } = useAuth()
  const { coached } = useCoached()
  const userId = effectiveUserId ?? user?.id ?? ''
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [sharedPrograms, setSharedPrograms] = useState<SharedProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [activateSuccess, setActivateSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user || !role) return
    async function load() {
      setLoading(true)

      // Fetch generated training programs
      const { data: progs } = await supabase
        .from('training_programs')
        .select('id, start_date, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (progs?.length) {
        const { data: weekRows } = await supabase
          .from('weekly_plans')
          .select('program_id')
          .in('program_id', progs.map(p => p.id))
        const countMap: Record<string, number> = {}
        weekRows?.forEach(w => { countMap[w.program_id] = (countMap[w.program_id] ?? 0) + 1 })
        setPrograms(progs.map((p, i) => ({
          ...p, week_count: countMap[p.id] ?? 0, is_current: i === 0,
        })))
      }

      // Fetch shared platform programs for this role
      const { data: shared } = await supabase
        .from('coach_programs')
        .select('id, name, weeks_total, shared_with_roles')
        .contains('shared_with_roles', [role])

      if (shared?.length) {
        // Check which ones this user has already activated
        const { data: activated } = await supabase
          .from('user_imported_programs')
          .select('source_coach_program_id')
          .eq('user_id', userId)
          .in('source_coach_program_id', shared.map(s => s.id))
        const activatedIds = new Set((activated ?? []).map(a => a.source_coach_program_id))
        setSharedPrograms(shared.map(s => ({ ...s, already_activated: activatedIds.has(s.id) })))
      }

      setLoading(false)
    }
    load()
  }, [user, userId, role])

  async function activateSharedProgram(coachProgramId: string, name: string) {
    setActivating(coachProgramId)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/user/activate-shared-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ coachProgramId }),
    })
    const data = await resp.json()
    if (data.programId) {
      setActivateSuccess(name)
      setSharedPrograms(prev => prev.map(p => p.id === coachProgramId ? { ...p, already_activated: true } : p))
    }
    setActivating(null)
  }

  if (authLoading || loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 20 }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Your Programs</h1>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>Every program available to your account.</p>

      {activateSuccess && (
        <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 2 }}>Program activated!</p>
          <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{activateSuccess} is now in your Import banner. Find it in Home or Calendar.</p>
          <button onClick={() => setActivateSuccess(null)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 700, padding: 0 }}>Dismiss</button>
        </div>
      )}

      {/* Featured / Shared programs — hidden while coached; programming comes from the coach */}
      {!coached && sharedPrograms.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
            Featured Programs
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sharedPrograms.map(prog => (
              <div
                key={prog.id}
                style={{ padding: '16px 18px', background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 100%)', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{prog.name}</p>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.25)' }}>
                        Featured
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{prog.weeks_total} weeks</p>
                  </div>
                </div>

                {prog.already_activated ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>✓ Activated</span>
                    <button
                      onClick={() => activateSharedProgram(prog.id, prog.name)}
                      disabled={!!activating}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', cursor: activating ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {activating === prog.id ? '…' : 'Restart from Week 1'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => activateSharedProgram(prog.id, prog.name)}
                    disabled={!!activating}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: activating === prog.id ? 'var(--surface2)' : 'var(--accent)', color: activating === prog.id ? 'var(--text-dim)' : '#fff', fontSize: 13, fontWeight: 700, cursor: activating ? 'default' : 'pointer', fontFamily: 'inherit' }}
                  >
                    {activating === prog.id ? 'Activating…' : 'Activate Program →'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated programs */}
      {programs.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
            AI-Generated Plans
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {programs.map(prog => (
              <div
                key={prog.id}
                style={{ padding: '16px 18px', background: prog.is_current ? 'var(--accent-bg)' : 'var(--surface)', border: `1.5px solid ${prog.is_current ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{programLabel(prog)}</p>
                      {prog.is_current && (
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                          Active
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{programRange(prog)}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                        {prog.week_count} / 13 weeks built
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                        {getPhase(Math.min(prog.week_count, 13))} Phase
                      </span>
                    </div>
                  </div>
                </div>
                {prog.is_current && (
                  <button
                    onClick={() => router.push('/plan')}
                    style={{ marginTop: 4, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'transparent', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                  >
                    View Plan →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {programs.length === 0 && sharedPrograms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No programs yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>Generate your first program from the Home tab.</p>
          <button onClick={() => router.push('/today')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Go to Home →
          </button>
        </div>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Programs auto-save when generated. Activating a Featured Program adds it to your training banner.
        </p>
      </div>
    </div>
  )
}
