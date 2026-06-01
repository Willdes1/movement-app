'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string   // local only — never persisted
  value: string
}

interface ManualDay {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  type: 'workout' | 'rest'
  label: string
  focus: string
  duration: string
  exercises: Exercise[]
}

interface ManualWeek {
  week_number: number
  label: string
  phase: string
  days: ManualDay[]
}

interface ClientOption {
  id: string
  name: string | null
}

interface ClientNote {
  id: string
  note: string
  session_date: string
}

interface ExerciseSuggestion {
  name_display: string
  tip: string | null
}

const DAYS: ManualDay['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PHASES = ['', 'Foundation', 'Build', 'Peak', 'Deload', 'Maintenance']
const DURATIONS = ['30 min', '45 min', '60 min', '75 min', '90 min', '120 min']

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function defaultDay(day: ManualDay['day'], isTraining: boolean): ManualDay {
  return {
    day,
    type: isTraining ? 'workout' : 'rest',
    label: '',
    focus: '',
    duration: '60 min',
    exercises: isTraining ? [{ id: makeId(), value: '' }] : [],
  }
}

function buildWeeks(count: number, daysPerWeek: number): ManualWeek[] {
  // Spread training days evenly — prefer Mon/Tue/Thu/Fri/Sat then add Wed/Sun
  const trainingOrder = ['Mon', 'Tue', 'Thu', 'Fri', 'Sat', 'Wed', 'Sun'] as ManualDay['day'][]
  const trainingSet = new Set(trainingOrder.slice(0, daysPerWeek))

  return Array.from({ length: count }, (_, i) => ({
    week_number: i + 1,
    label: `Week ${i + 1}`,
    phase: '',
    days: DAYS.map(d => defaultDay(d, trainingSet.has(d))),
  }))
}

// ── Sortable exercise row ─────────────────────────────────────────────────────

function SortableExercise({
  ex, onChange, onRemove, onKeyDown, inputRef, showRemove,
  suggestions, onSelectSuggestion, showSuggestions, onFocus, onBlur,
  relevantNotes,
}: {
  ex: Exercise
  onChange: (val: string) => void
  onRemove: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  showRemove: boolean
  suggestions: ExerciseSuggestion[]
  onSelectSuggestion: (name: string) => void
  showSuggestions: boolean
  onFocus: () => void
  onBlur: () => void
  relevantNotes: ClientNote[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-dim)', fontSize: 14, flexShrink: 0, padding: '0 2px', touchAction: 'none' }}
          title="Drag to reorder"
        >
          ⠿
        </span>

        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            value={ex.value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Exercise name + sets/reps (e.g. Bench Press 4x8)"
            style={{
              width: '100%', padding: '7px 10px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', fontSize: 12,
              boxSizing: 'border-box', fontFamily: 'inherit',
              borderBottomLeftRadius: showSuggestions && suggestions.length > 0 ? 0 : 8,
              borderBottomRightRadius: showSuggestions && suggestions.length > 0 ? 0 : 8,
            }}
          />

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderTop: 'none', borderRadius: '0 0 8px 8px',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onMouseDown={e => { e.preventDefault(); onSelectSuggestion(s.name_display) }}
                  style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.name_display}</div>
                  {s.tip && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{s.tip}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {showRemove && (
          <button
            onClick={onRemove}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0, lineHeight: 1 }}
            title="Remove exercise"
          >
            ✕
          </button>
        )}
      </div>

      {/* Client note reminder for this exercise */}
      {relevantNotes.length > 0 && (
        <div style={{ marginTop: 4, marginLeft: 22 }}>
          {relevantNotes.map(n => (
            <div key={n.id} style={{
              fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5,
              padding: '3px 8px', marginBottom: 2, lineHeight: 1.4,
            }}>
              🔔 {new Date(n.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {n.note.length > 120 ? n.note.slice(0, 120) + '…' : n.note}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Day editor ────────────────────────────────────────────────────────────────

function DayEditor({
  day, weekIdx, dayIdx, onUpdate, clientNotes,
}: {
  day: ManualDay
  weekIdx: number
  dayIdx: number
  onUpdate: (weekIdx: number, dayIdx: number, updated: ManualDay) => void
  clientNotes: ClientNote[]
}) {
  const [focusedExId, setFocusedExId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastInputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function update(patch: Partial<ManualDay>) {
    onUpdate(weekIdx, dayIdx, { ...day, ...patch })
  }

  function updateExercise(exId: string, val: string) {
    update({ exercises: day.exercises.map(e => e.id === exId ? { ...e, value: val } : e) })
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.trim().length > 1) {
      searchTimer.current = setTimeout(() => searchExercises(val.trim()), 250)
    } else {
      setSuggestions([])
    }
  }

  async function searchExercises(q: string) {
    const { data } = await supabase
      .from('exercise_library')
      .select('name_display, tip')
      .ilike('name_display', `%${q}%`)
      .order('name_display')
      .limit(6)
    setSuggestions((data ?? []) as ExerciseSuggestion[])
  }

  function selectSuggestion(exId: string, name: string) {
    update({ exercises: day.exercises.map(e => e.id === exId ? { ...e, value: name } : e) })
    setSuggestions([])
    setFocusedExId(null)
  }

  function addExercise() {
    const newEx = { id: makeId(), value: '' }
    update({ exercises: [...day.exercises, newEx] })
    setTimeout(() => lastInputRef.current?.focus(), 50)
  }

  function removeExercise(exId: string) {
    if (day.exercises.length <= 1) return
    update({ exercises: day.exercises.filter(e => e.id !== exId) })
  }

  function handleExKeyDown(e: React.KeyboardEvent, exId: string, exIdx: number) {
    if (e.key === 'Enter') { e.preventDefault(); addExercise() }
    if (e.key === 'Backspace') {
      const ex = day.exercises[exIdx]
      if (!ex.value && day.exercises.length > 1) {
        e.preventDefault()
        removeExercise(exId)
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = day.exercises.findIndex(e => e.id === active.id)
    const newIdx = day.exercises.findIndex(e => e.id === over.id)
    update({ exercises: arrayMove(day.exercises, oldIdx, newIdx) })
  }

  // Find client notes relevant to a given exercise value
  function notesForExercise(exValue: string): ClientNote[] {
    if (!exValue.trim() || clientNotes.length === 0) return []
    const terms = exValue.toLowerCase().split(/\s+/).filter(t => t.length > 3)
    return clientNotes.filter(n =>
      terms.some(term => n.note.toLowerCase().includes(term))
    )
  }

  if (day.type === 'rest') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, opacity: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', minWidth: 24, textTransform: 'uppercase' }}>{day.day}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Rest Day</span>
        </div>
        <button
          onClick={() => update({ type: 'workout', label: '', focus: '', duration: '60 min', exercises: [{ id: makeId(), value: '' }] })}
          style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 }}
        >
          + Training
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Day header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--accent)', minWidth: 24, textTransform: 'uppercase' }}>{day.day}</span>
        <input
          value={day.label}
          onChange={e => update({ label: e.target.value })}
          placeholder="Session name (e.g. Upper Push)"
          style={{ flex: 2, minWidth: 120, padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
        />
        <input
          value={day.focus}
          onChange={e => update({ focus: e.target.value })}
          placeholder="Focus (e.g. Chest, Shoulders)"
          style={{ flex: 2, minWidth: 120, padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
        />
        <select
          value={day.duration}
          onChange={e => update({ duration: e.target.value })}
          style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
        >
          {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button
          onClick={() => update({ type: 'rest', label: '', focus: '', duration: '—', exercises: [] })}
          style={{ fontSize: 10, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          Set rest
        </button>
      </div>

      {/* Exercise list */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={day.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
            {day.exercises.map((ex, exIdx) => (
              <SortableExercise
                key={ex.id}
                ex={ex}
                onChange={val => updateExercise(ex.id, val)}
                onRemove={() => removeExercise(ex.id)}
                onKeyDown={e => handleExKeyDown(e, ex.id, exIdx)}
                inputRef={exIdx === day.exercises.length - 1 ? lastInputRef : undefined}
                showRemove={day.exercises.length > 1}
                suggestions={focusedExId === ex.id ? suggestions : []}
                onSelectSuggestion={name => selectSuggestion(ex.id, name)}
                showSuggestions={focusedExId === ex.id}
                onFocus={() => setFocusedExId(ex.id)}
                onBlur={() => setTimeout(() => setFocusedExId(null), 150)}
                relevantNotes={notesForExercise(ex.value)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={addExercise}
          style={{ alignSelf: 'flex-start', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontWeight: 700, marginTop: 2 }}
        >
          + Add exercise
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManualProgramBuilder({
  coachId,
  onBack,
  onSaved,
}: {
  coachId: string
  onBack: () => void
  onSaved: (programId: string) => void
}) {
  // Setup form
  const [setupDone, setSetupDone] = useState(false)
  const [programName, setProgramName] = useState('')
  const [weeksTotal, setWeeksTotal] = useState(8)
  const [daysPerWeek, setDaysPerWeek] = useState(4)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([])

  // Builder state
  const [weeks, setWeeks] = useState<ManualWeek[]>([])
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load coach's clients for the selector
  useEffect(() => {
    supabase
      .from('coach_clients')
      .select('client_id, profiles!inner(id, name)')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .then(({ data }) => {
        const list = (data ?? []).map((r: any) => ({
          id: r.profiles[0]?.id ?? r.client_id,
          name: r.profiles[0]?.name ?? null,
        }))
        setClients(list)
      })
  }, [coachId])

  // Load client notes when client is selected
  useEffect(() => {
    if (!selectedClientId) { setClientNotes([]); return }
    supabase
      .from('coach_client_notes')
      .select('id, note, session_date')
      .eq('coach_id', coachId)
      .eq('client_id', selectedClientId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setClientNotes((data ?? []) as ClientNote[]))
  }, [selectedClientId, coachId])

  function startBuilding() {
    if (!programName.trim()) return
    setWeeks(buildWeeks(weeksTotal, daysPerWeek))
    setExpandedWeeks(new Set([1]))
    setSetupDone(true)
  }

  function updateDay(weekIdx: number, dayIdx: number, updated: ManualDay) {
    setWeeks(prev => prev.map((w, wi) =>
      wi !== weekIdx ? w : { ...w, days: w.days.map((d, di) => di !== dayIdx ? d : updated) }
    ))
  }

  function updateWeekMeta(weekIdx: number, patch: Partial<ManualWeek>) {
    setWeeks(prev => prev.map((w, i) => i === weekIdx ? { ...w, ...patch } : w))
  }

  function copyWeekToAll(weekIdx: number) {
    const source = weeks[weekIdx]
    setWeeks(prev => prev.map((w, i) =>
      i === weekIdx ? w : {
        ...w,
        days: source.days.map(d => ({
          ...d,
          exercises: d.exercises.map(e => ({ ...e, id: makeId() })),
        })),
      }
    ))
  }

  function toggleWeek(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expired — please refresh.'); setSaving(false); return }

    const { data: prog, error: progErr } = await supabase
      .from('coach_programs')
      .insert({
        coach_id: session.user.id,
        name: programName.trim(),
        source: 'manual',
        weeks_total: weeksTotal,
        status: 'draft',
        is_template: false,
        notes: selectedClientId ? `Built for client ${selectedClientId}` : null,
      })
      .select('id')
      .single()

    if (progErr || !prog) { setError(progErr?.message ?? 'Save failed'); setSaving(false); return }

    const weekRows = weeks.map(w => ({
      program_id: prog.id,
      week_number: w.week_number,
      label: w.label,
      phase: w.phase || null,
      coach_notes: '',
      days: w.days.map(d => ({
        day: d.day,
        label: d.label || (d.type === 'rest' ? 'Rest Day' : 'Training'),
        type: d.type,
        movements: d.exercises.map(e => e.value).filter(Boolean),
        focus: d.focus,
        duration: d.duration,
      })),
    }))

    const { error: weeksErr } = await supabase.from('coach_program_weeks').insert(weekRows)
    if (weeksErr) { setError(weeksErr.message); setSaving(false); return }

    onSaved(prog.id)
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const trainingDays = weeks.flatMap(w => w.days.filter(d => d.type === 'workout')).length

  // ── Setup form ──────────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={{ padding: '40px 40px 80px', maxWidth: 640 }}>
        <button onClick={onBack}
          style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back
        </button>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Manual Builder</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Set Up Your Program</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>Fill in the basics and we'll build the week structure for you.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Program name */}
          <div>
            <label style={labelStyle}>Program Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              value={programName}
              onChange={e => setProgramName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && programName.trim() && startBuilding()}
              placeholder="e.g. 8-Week Hypertrophy Block"
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* Weeks + Days */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Program Length</label>
              <select value={weeksTotal} onChange={e => setWeeksTotal(Number(e.target.value))} style={selectStyle}>
                {[1, 2, 3, 4, 6, 8, 10, 12, 13].map(w => <option key={w} value={w}>{w} week{w !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Training Days / Week</label>
              <select value={daysPerWeek} onChange={e => setDaysPerWeek(Number(e.target.value))} style={selectStyle}>
                {[2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d} day{d !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>

          {/* Optional client */}
          {clients.length > 0 && (
            <div>
              <label style={labelStyle}>Building for a specific client? <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
              <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} style={selectStyle}>
                <option value="">No client selected</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? 'Unnamed'}</option>)}
              </select>
              {selectedClientId && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b' }}>
                  🔔 Session notes for {selectedClient?.name?.split(' ')[0]} will appear as reminders while you add exercises.
                </div>
              )}
            </div>
          )}

          <button
            onClick={startBuilding}
            disabled={!programName.trim()}
            style={{
              alignSelf: 'flex-start', padding: '13px 32px',
              background: programName.trim() ? 'var(--accent)' : 'var(--surface2)',
              color: programName.trim() ? '#fff' : 'var(--text-dim)',
              border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15,
              cursor: programName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Start Building →
          </button>
        </div>
      </div>
    )
  }

  // ── Builder ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '40px 40px 100px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button onClick={() => setSetupDone(false)}
            style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Setup
          </button>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Manual Builder</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>{programName}</h1>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {weeksTotal} week{weeksTotal !== 1 ? 's' : ''} · {trainingDays} training day{trainingDays !== 1 ? 's' : ''}
            {selectedClient ? ` · ${selectedClient.name}` : ''}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '11px 28px', background: saving ? 'var(--surface2)' : 'var(--accent)', color: saving ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>{error}</div>
      )}

      {/* Client notes panel */}
      {selectedClient && clientNotes.length > 0 && (
        <div style={{ marginBottom: 24, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            🔔 Get to Know Your Client — {selectedClient.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            Notes will highlight below each exercise if a relevant session note exists.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
            Last note ({new Date(clientNotes[0].session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}):
            <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 6 }}>
              {clientNotes[0].note.length > 160 ? clientNotes[0].note.slice(0, 160) + '…' : clientNotes[0].note}
            </span>
          </div>
        </div>
      )}

      {/* Week accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {weeks.map((week, wi) => {
          const open = expandedWeeks.has(week.week_number)
          const trainingDayCount = week.days.filter(d => d.type === 'workout').length
          return (
            <div key={week.week_number} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Week header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: open ? '1px solid var(--border)' : 'none' }}>
                <button
                  onClick={() => toggleWeek(week.week_number)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>Week {week.week_number}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{trainingDayCount} training day{trainingDayCount !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 'auto' }}>▾</span>
                </button>

                {/* Week meta */}
                <input
                  value={week.label}
                  onChange={e => updateWeekMeta(wi, { label: e.target.value })}
                  placeholder={`Week ${week.week_number}`}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 140, padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                />
                <select
                  value={week.phase}
                  onChange={e => updateWeekMeta(wi, { phase: e.target.value })}
                  onClick={e => e.stopPropagation()}
                  style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: week.phase ? 'var(--text)' : 'var(--text-dim)', fontSize: 12, fontFamily: 'inherit' }}
                >
                  {PHASES.map(p => <option key={p} value={p}>{p || 'Phase (optional)'}</option>)}
                </select>
                {wi === 0 && weeks.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); copyWeekToAll(wi) }}
                    title="Copy this week's structure to all other weeks"
                    style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent)12', border: '1px solid var(--accent)40', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Copy to all weeks
                  </button>
                )}
              </div>

              {/* Days */}
              {open && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {week.days.map((day, di) => (
                    <DayEditor
                      key={day.day}
                      day={day}
                      weekIdx={wi}
                      dayIdx={di}
                      onUpdate={updateDay}
                      clientNotes={clientNotes}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom save */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '13px 36px', background: saving ? 'var(--surface2)' : 'var(--accent)', color: saving ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  boxSizing: 'border-box', fontFamily: 'inherit',
}
