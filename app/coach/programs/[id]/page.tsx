'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ParsedDay {
  day: string
  label: string
  type: string
  movements: string[]
  focus: string
  duration: string
}

interface Week {
  id: string
  week_number: number
  label: string
  phase: string | null
  days: ParsedDay[]
  coach_notes: string
}

interface Program {
  id: string
  name: string
  status: string
  source: string
  weeks_total: number
  import_filename: string | null
  notes: string | null
  created_at: string
}

interface ClientResult {
  id: string
  name: string | null
  role: string
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f59e0b18', color: '#f59e0b' },
  active:    { bg: '#22c55e18', color: '#22c55e' },
  published: { bg: '#3b82f618', color: '#3b82f6' },
  archived:  { bg: '#6b728018', color: '#9ca3af' },
  paused:    { bg: '#ef444418', color: '#ef4444' },
}

export default function ProgramDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [program, setProgram] = useState<Program | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [error, setError] = useState('')

  // Assign modal state
  const [showAssign, setShowAssign] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignResults, setAssignResults] = useState<ClientResult[]>([])
  const [assignSearching, setAssignSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [assignSuccess, setAssignSuccess] = useState('')
  const [assignError, setAssignError] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user || !id) return
    fetchProgram()
  }, [user, id])

  async function fetchProgram() {
    setLoading(true)
    const { data: prog, error: progErr } = await supabase
      .from('coach_programs')
      .select('id, name, status, source, weeks_total, import_filename, notes, created_at')
      .eq('id', id)
      .eq('coach_id', user!.id)
      .single()

    if (progErr || !prog) { setNotFound(true); setLoading(false); return }
    setProgram(prog)
    setTitleDraft(prog.name)

    const { data: weekData } = await supabase
      .from('coach_program_weeks')
      .select('id, week_number, label, phase, days, coach_notes')
      .eq('program_id', id)
      .order('week_number', { ascending: true })

    setWeeks(weekData ?? [])
    setLoading(false)
  }

  async function saveTitle() {
    if (!program || titleDraft.trim() === program.name) { setEditingTitle(false); return }
    setSavingTitle(true)
    const { error } = await supabase
      .from('coach_programs')
      .update({ name: titleDraft.trim() })
      .eq('id', id).eq('coach_id', user!.id)
    if (error) setError(error.message)
    else setProgram(prev => prev ? { ...prev, name: titleDraft.trim() } : prev)
    setSavingTitle(false)
    setEditingTitle(false)
  }

  async function updateStatus(newStatus: string) {
    const { error } = await supabase
      .from('coach_programs')
      .update({ status: newStatus })
      .eq('id', id).eq('coach_id', user!.id)
    if (error) setError(error.message)
    else setProgram(prev => prev ? { ...prev, status: newStatus } : prev)
  }

  function toggleWeek(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  // ── Assign modal logic ─────────────────────────────────────────────────────
  function openAssignModal() {
    setAssignSearch('')
    setAssignResults([])
    setSelectedClient(null)
    setAssignStartDate(new Date().toISOString().slice(0, 10))
    setAssignSuccess('')
    setAssignError('')
    setShowAssign(true)
  }

  function handleSearchChange(val: string) {
    setAssignSearch(val)
    setSelectedClient(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim()) { setAssignResults([]); return }
    searchTimer.current = setTimeout(() => searchProfiles(val.trim()), 350)
  }

  async function searchProfiles(q: string) {
    setAssignSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role')
      .ilike('name', `%${q}%`)
      .neq('id', user!.id)
      .limit(8)
    setAssignResults(data ?? [])
    setAssignSearching(false)
  }

  async function handleAssign() {
    if (!selectedClient || !program) return
    setAssigning(true)
    setAssignError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setAssignError('Session expired — please refresh.')
      setAssigning(false)
      return
    }

    // Upsert into coach_clients roster
    const { error: rosterErr } = await supabase
      .from('coach_clients')
      .upsert({ coach_id: session.user.id, client_id: selectedClient.id, status: 'active' },
               { onConflict: 'coach_id,client_id' })

    if (rosterErr) { setAssignError(rosterErr.message); setAssigning(false); return }

    // Insert assignment
    const { error: assignErr } = await supabase
      .from('coach_program_assignments')
      .insert({
        program_id: program.id,
        coach_id:   session.user.id,
        client_id:  selectedClient.id,
        start_date: assignStartDate,
        status:     'active',
      })

    if (assignErr) { setAssignError(assignErr.message); setAssigning(false); return }

    setAssignSuccess(`Assigned to ${selectedClient.name ?? 'client'} — starting ${assignStartDate}`)
    setAssigning(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading program…</div>
  )

  if (notFound || !program) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16 }}>Program not found.</div>
      <button onClick={() => router.push('/coach/programs')}
        style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Back to Programs
      </button>
    </div>
  )

  const statusStyle = STATUS_COLOR[program.status] ?? STATUS_COLOR.draft
  const trainingDays = weeks.flatMap(w => w.days.filter(d => d.type !== 'rest')).length
  const totalExercises = weeks.flatMap(w => w.days.flatMap(d => d.movements)).filter(m => m !== 'Full rest').length

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>

      {/* Back */}
      <button onClick={() => router.push('/coach/programs')}
        style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← My Programs
      </button>

      {error && (
        <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Coach Portal
          </div>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                autoFocus
                style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--text)', padding: '4px 10px', minWidth: 280, maxWidth: 500 }}
              />
              <button onClick={saveTitle} disabled={savingTitle}
                style={{ padding: '6px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {savingTitle ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setTitleDraft(program.name); setEditingTitle(false) }}
                style={{ padding: '6px 12px', background: 'none', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>{program.name}</h1>
              <button onClick={() => setEditingTitle(true)}
                style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Status + actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 12px', borderRadius: 20, background: statusStyle.bg, color: statusStyle.color }}>
            {program.status}
          </span>
          {program.status === 'draft' && (
            <button onClick={() => updateStatus('active')}
              style={{ padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Publish
            </button>
          )}
          {program.status === 'active' && (
            <button onClick={() => updateStatus('archived')}
              style={{ padding: '8px 18px', background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Archive
            </button>
          )}
          {program.status === 'archived' && (
            <button onClick={() => updateStatus('active')}
              style={{ padding: '8px 18px', background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Restore
            </button>
          )}
          <button onClick={openAssignModal}
            style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Assign to Client
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Weeks', value: program.weeks_total },
          { label: 'Training Days', value: trainingDays },
          { label: 'Exercises', value: totalExercises },
          { label: 'Source', value: program.import_filename ?? program.source },
          { label: 'Saved', value: formatDate(program.created_at) },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {program.notes && (
        <div style={{ marginBottom: 28, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 720, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
          {program.notes}
        </div>
      )}

      {/* Week accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {weeks.map(week => {
          const open = expandedWeeks.has(week.week_number)
          const workoutDays = week.days.filter(d => d.type !== 'rest')
          return (
            <div key={week.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => toggleWeek(week.week_number)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{week.label || `Week ${week.week_number}`}</span>
                  {week.phase && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent)18', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {week.phase}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{workoutDays.length} training day{workoutDays.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                </div>
              </button>

              {open && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {week.days.map((day, di) => (
                    <div key={di} style={{ background: day.type === 'rest' ? 'transparent' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', opacity: day.type === 'rest' ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: day.type === 'rest' ? 0 : 8, gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', minWidth: 28 }}>{day.day}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{day.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {day.focus && day.type !== 'rest' && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.focus}</span>}
                          {day.duration && day.duration !== '—' && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 20 }}>{day.duration}</span>
                          )}
                        </div>
                      </div>
                      {day.type !== 'rest' && day.movements.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {day.movements.map((m, mi) => (
                            <div key={mi} style={{ fontSize: 12, color: 'var(--text-dim)', paddingLeft: 36 }}>• {m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {weeks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-dim)', fontSize: 14 }}>
          No weeks found for this program.
        </div>
      )}

      {/* ── Assign to Client modal ────────────────────────────────────────── */}
      {showAssign && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowAssign(false) }}
          style={{
            position: 'fixed', inset: 0, background: '#00000080', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: 28, width: '100%', maxWidth: 480,
            display: 'flex', flexDirection: 'column', gap: 18,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Assign to Client</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{program.name}</div>
              </div>
              <button onClick={() => setShowAssign(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>
                ✕
              </button>
            </div>

            {assignSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 40 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{assignSuccess}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => { setAssignSuccess(''); setSelectedClient(null); setAssignSearch(''); setAssignResults([]) }}
                    style={{ padding: '8px 18px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Assign Another
                  </button>
                  <button onClick={() => router.push('/coach/clients')}
                    style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    View Clients
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                    Search by name
                  </label>
                  <input
                    value={assignSearch}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Type a client's name…"
                    autoFocus
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                {/* Results */}
                {assignSearching && (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>Searching…</div>
                )}
                {!assignSearching && assignResults.length > 0 && !selectedClient && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assignResults.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedClient(r)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', background: 'var(--surface2)',
                          border: '1px solid var(--border)', borderRadius: 10,
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'var(--accent)22', color: 'var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 800, flexShrink: 0,
                        }}>
                          {(r.name ?? '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.name ?? 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{r.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!assignSearching && assignSearch.length > 1 && assignResults.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>No users found — try a different name.</div>
                )}

                {/* Selected client */}
                {selectedClient && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--accent)12', border: '1px solid var(--accent)40', borderRadius: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)22', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                      {(selectedClient.name ?? '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedClient.name ?? 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Selected</div>
                    </div>
                    <button onClick={() => { setSelectedClient(null); setAssignSearch(''); setAssignResults([]) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                  </div>
                )}

                {/* Start date */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                    Start date
                  </label>
                  <input
                    type="date"
                    value={assignStartDate}
                    onChange={e => setAssignStartDate(e.target.value)}
                    style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, colorScheme: 'dark' }}
                  />
                </div>

                {assignError && (
                  <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13 }}>
                    {assignError}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleAssign}
                  disabled={!selectedClient || assigning}
                  style={{
                    padding: '12px 24px', background: selectedClient ? 'var(--accent)' : 'var(--surface2)',
                    color: selectedClient ? '#fff' : 'var(--text-dim)',
                    border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14,
                    cursor: selectedClient && !assigning ? 'pointer' : 'not-allowed',
                    opacity: assigning ? 0.6 : 1,
                  }}
                >
                  {assigning ? 'Assigning…' : selectedClient ? `Assign to ${selectedClient.name ?? 'client'}` : 'Select a client first'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
