'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import CoachInstructionFields, { type Cues, BLANK_CUES } from '@/components/coach/CoachInstructionFields'

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
  shared_with_roles: string[]
}

interface SwapTarget {
  weekId: string
  dayIndex: number
  movementIndex: number
  current: string
}

interface ExerciseResult {
  name_display: string
  name_normalized: string
  tip: string | null
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f59e0b18', color: '#f59e0b' },
  active:    { bg: '#22c55e18', color: '#22c55e' },
  published: { bg: '#3b82f618', color: '#3b82f6' },
  archived:  { bg: '#6b728018', color: '#9ca3af' },
  paused:    { bg: '#ef444418', color: '#ef4444' },
}

// Extract "4x5" / "3x8-12" scheme from a movement string
function extractScheme(movement: string): string {
  const match = movement.match(/\d+\s*[x×]\s*[\d][\d\-]*(\s*(each|side|arm|leg|min|sec))?/i)
  return match ? match[0].trim() : ''
}

// Strip the sets/reps scheme → clean exercise name (matches the athlete side).
function stripSchemeName(raw: string): string {
  return raw.replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
}
// Normalized key that lines up with my-program's normKey + the athlete's lookup.
function normKey(raw: string): string {
  return stripSchemeName(raw).toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

export default function ProgramDetailPage() {
  const { user, isAdmin } = useAuth()
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
  const [hoveredMovement, setHoveredMovement] = useState<string | null>(null)

  // Assign modal state
  const [showAssign, setShowAssign] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignResults, setAssignResults] = useState<{ id: string; name: string | null; role: string }[]>([])
  const [assignSearching, setAssignSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string | null; role: string } | null>(null)
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [assignSuccess, setAssignSuccess] = useState('')
  const [assignError, setAssignError] = useState('')
  // Set when the selected client already has an active program — requires explicit confirm
  const [replaceWarning, setReplaceWarning] = useState<{ programName: string; startDate: string } | null>(null)
  const assignSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Swap modal state
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null)
  const [swapSearch, setSwapSearch] = useState('')
  const [swapResults, setSwapResults] = useState<ExerciseResult[]>([])
  const [swapSearching, setSwapSearching] = useState(false)
  const [customSwap, setCustomSwap] = useState('')
  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState('')
  const swapSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Admin: platform sharing
  const [sharedRoles, setSharedRoles] = useState<string[]>([])
  const [sharingLoading, setSharingLoading] = useState(false)
  const [seedingExercises, setSeedingExercises] = useState(false)
  const [seedResult, setSeedResult] = useState<{ seeded: number; total: number; queued: number; updated: number } | null>(null)
  const [genDetails, setGenDetails] = useState(false)
  const [detailsResult, setDetailsResult] = useState<{ generated: number; remaining: number; total: number } | null>(null)

  // Import program exercises → coach library
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null)

  // In-place per-exercise instruction editor
  const [cuesTarget, setCuesTarget] = useState<{ name: string } | null>(null)
  const [cues, setCues] = useState<Cues>(BLANK_CUES)
  const [cuesRowId, setCuesRowId] = useState<string | null>(null)
  const [cuesBusy, setCuesBusy] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    fetchProgram()
  }, [user, id])

  async function fetchProgram() {
    setLoading(true)
    const { data: prog, error: progErr } = await supabase
      .from('coach_programs')
      .select('id, name, status, source, weeks_total, import_filename, notes, created_at, shared_with_roles')
      .eq('id', id)
      .eq('coach_id', user!.id)
      .single()

    if (progErr || !prog) { setNotFound(true); setLoading(false); return }
    setProgram(prog as Program)
    setTitleDraft(prog.name)
    setSharedRoles(prog.shared_with_roles ?? [])

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
    const { error } = await supabase.from('coach_programs').update({ name: titleDraft.trim() }).eq('id', id).eq('coach_id', user!.id)
    if (error) setError(error.message)
    else setProgram(prev => prev ? { ...prev, name: titleDraft.trim() } : prev)
    setSavingTitle(false)
    setEditingTitle(false)
  }

  async function updateStatus(newStatus: string) {
    const { error } = await supabase.from('coach_programs').update({ status: newStatus }).eq('id', id).eq('coach_id', user!.id)
    if (error) setError(error.message)
    else setProgram(prev => prev ? { ...prev, status: newStatus } : prev)
  }

  async function toggleRole(role: string) {
    setSharingLoading(true)
    const next = sharedRoles.includes(role)
      ? sharedRoles.filter(r => r !== role)
      : [...sharedRoles, role]
    const { error } = await supabase.from('coach_programs').update({ shared_with_roles: next }).eq('id', id)
    if (!error) setSharedRoles(next)
    setSharingLoading(false)
  }

  async function seedExercises() {
    setSeedingExercises(true)
    setSeedResult(null)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const resp = await fetch('/api/admin/seed-program-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ programId: id }),
      })
      const data = await resp.json()
      setSeedResult({ seeded: data.seeded ?? 0, total: data.total ?? 0, queued: data.queued ?? 0, updated: data.updated ?? 0 })
    } catch { /* silent */ }
    setSeedingExercises(false)
  }

  // Admin: AI-generate + save the standard instructions (how/breathing/core/tip)
  // for this program's exercises that are missing them. Chunked — click again to
  // continue until remaining hits 0.
  async function generateDetails() {
    setGenDetails(true)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const resp = await fetch('/api/admin/generate-program-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ programId: id }),
      })
      const data = await resp.json()
      setDetailsResult({ generated: data.generated ?? 0, remaining: data.remaining ?? 0, total: data.total ?? 0 })
    } catch { /* silent */ }
    setGenDetails(false)
  }

  // Part A — pull this program's exercises into the coach's Library (deduped),
  // pre-filling each with the standard cues for FREE from the global library.
  async function importToLibrary() {
    if (!user) return
    setImporting(true); setImportResult(null)
    // Unique exercises across the program (skip rest days)
    const seen = new Map<string, string>() // normKey -> clean display name
    for (const w of weeks) {
      for (const day of w.days) {
        if (day.type === 'rest') continue
        for (const m of day.movements) {
          const k = normKey(m)
          if (k.length > 2 && !seen.has(k)) seen.set(k, stripSchemeName(m))
        }
      }
    }
    const all = [...seen.entries()] // [normKey, display]
    // Dedup against what's already in the coach's library
    const { data: existing } = await supabase
      .from('coach_exercise_library').select('name').eq('coach_id', user.id)
    const have = new Set((existing ?? []).map(e => normKey(e.name as string)))
    const toAdd = all.filter(([k]) => !have.has(k))
    if (!toAdd.length) { setImportResult({ imported: 0, total: all.length }); setImporting(false); return }
    // Pre-fill standard cues from the global library
    const { data: globalRows } = await supabase
      .from('exercise_library').select('name_normalized, how, breathing, core, tip')
      .in('name_normalized', toAdd.map(([k]) => k))
    const gMap = new Map((globalRows ?? []).map(r => [r.name_normalized as string, r]))
    const rows = toAdd.map(([k, display]) => {
      const g = gMap.get(k)
      return {
        coach_id: user.id, name: display, name_normalized: k,
        how: g?.how ?? null, breathing: g?.breathing ?? null, core: g?.core ?? null, tip: g?.tip ?? null,
        custom_fields: [],
      }
    })
    await supabase.from('coach_exercise_library').insert(rows)
    setImportResult({ imported: rows.length, total: all.length })
    setImporting(false)
  }

  // Part B — open the in-place instruction editor for one exercise.
  async function openCues(movement: string) {
    const name = stripSchemeName(movement)
    setCuesTarget({ name }); setCues(BLANK_CUES); setCuesRowId(null); setCuesBusy(true)
    const { data } = await supabase
      .from('coach_exercise_library')
      .select('id, how, breathing, core, tip, custom_fields')
      .eq('coach_id', user!.id).eq('name_normalized', normKey(movement)).single()
    if (data) {
      setCuesRowId(data.id)
      setCues({
        how: data.how ?? '', breathing: data.breathing ?? '', core: data.core ?? '', tip: data.tip ?? '',
        custom_fields: Array.isArray(data.custom_fields) ? data.custom_fields : [],
      })
    }
    setCuesBusy(false)
  }

  async function saveCues() {
    if (!cuesTarget || !user) return
    setCuesBusy(true)
    const clean = {
      how: cues.how.trim() || null, breathing: cues.breathing.trim() || null,
      core: cues.core.trim() || null, tip: cues.tip.trim() || null,
      custom_fields: cues.custom_fields.map(c => ({ label: c.label.trim(), text: c.text.trim() })).filter(c => c.label && c.text),
    }
    if (cuesRowId) {
      await supabase.from('coach_exercise_library').update(clean).eq('id', cuesRowId)
    } else {
      await supabase.from('coach_exercise_library').insert({
        coach_id: user.id, name: cuesTarget.name, name_normalized: normKey(cuesTarget.name), ...clean,
      })
    }
    setCuesBusy(false); setCuesTarget(null)
  }

  function toggleWeek(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  // ── Assign modal ──────────────────────────────────────────────────────────
  function openAssignModal() {
    setAssignSearch(''); setAssignResults([]); setSelectedClient(null)
    setAssignStartDate(new Date().toISOString().slice(0, 10))
    setAssignSuccess(''); setAssignError(''); setReplaceWarning(null); setShowAssign(true)
  }

  function handleAssignSearchChange(val: string) {
    setAssignSearch(val); setSelectedClient(null); setReplaceWarning(null)
    if (assignSearchTimer.current) clearTimeout(assignSearchTimer.current)
    if (!val.trim()) { setAssignResults([]); return }
    assignSearchTimer.current = setTimeout(() => searchProfiles(val.trim()), 350)
  }

  async function searchProfiles(q: string) {
    setAssignSearching(true)
    const { data } = await supabase.from('profiles').select('id, name, role').ilike('name', `%${q}%`).neq('id', user!.id).limit(8)
    setAssignResults(data ?? [])
    setAssignSearching(false)
  }

  async function handleAssign() {
    if (!selectedClient || !program) return
    setAssigning(true); setAssignError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAssignError('Session expired — please refresh.'); setAssigning(false); return }

    const isSelf = selectedClient.id === session.user.id

    // New model (Chunk 5a): assigning creates a PENDING assignment. It does NOT
    // take over — the athlete gets a prompt and taps Activate (which retires any
    // current active program at that point). Cancel any prior pending from this
    // coach to this client so prompts don't stack.
    await supabase.from('coach_program_assignments')
      .update({ status: 'cancelled' })
      .eq('coach_id', session.user.id).eq('client_id', selectedClient.id).eq('status', 'pending')

    // Self-assignments skip the roster — a coach shouldn't appear in their own client list
    if (!isSelf) {
      const { error: rosterErr } = await supabase.from('coach_clients')
        .upsert({ coach_id: session.user.id, client_id: selectedClient.id, status: 'active' }, { onConflict: 'coach_id,client_id' })
      if (rosterErr) { setAssignError(rosterErr.message); setAssigning(false); return }
    }

    const { error: assignErr } = await supabase.from('coach_program_assignments').insert({
      program_id: program.id, coach_id: session.user.id,
      client_id: selectedClient.id, start_date: assignStartDate, status: 'pending',
    })
    if (assignErr) { setAssignError(assignErr.message); setAssigning(false); return }

    // Best-effort push so they know to open the app.
    fetch('/api/coach/notify-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ clientId: selectedClient.id, programName: program.name }),
    }).catch(() => {})

    setReplaceWarning(null)
    setAssignSuccess(isSelf
      ? `Assigned to yourself — open your athlete app and tap Activate to start it`
      : `Sent to ${selectedClient.name ?? 'client'} — they'll get a prompt to activate it`)
    setAssigning(false)
  }

  // ── Swap modal ────────────────────────────────────────────────────────────
  function openSwap(weekId: string, dayIndex: number, movementIndex: number, current: string) {
    setSwapTarget({ weekId, dayIndex, movementIndex, current })
    setSwapSearch(''); setSwapResults([]); setCustomSwap('')
    setSwapError(''); setSwapping(false)
  }

  function handleSwapSearchChange(val: string) {
    setSwapSearch(val)
    if (swapSearchTimer.current) clearTimeout(swapSearchTimer.current)
    if (!val.trim()) { setSwapResults([]); return }
    swapSearchTimer.current = setTimeout(() => searchExercises(val.trim()), 300)
  }

  async function searchExercises(q: string) {
    setSwapSearching(true)
    const { data } = await supabase
      .from('exercise_library')
      .select('name_display, name_normalized, tip')
      .ilike('name_display', `%${q}%`)
      .order('name_display')
      .limit(8)
    setSwapResults(data ?? [])
    setSwapSearching(false)
  }

  async function confirmSwap(newExerciseName: string) {
    if (!swapTarget || swapping) return
    setSwapping(true); setSwapError('')

    const week = weeks.find(w => w.id === swapTarget.weekId)
    if (!week) { setSwapping(false); return }

    // Preserve the sets/reps scheme from the original movement
    const scheme = extractScheme(swapTarget.current)
    const newMovement = scheme ? `${newExerciseName} ${scheme}` : newExerciseName

    const updatedDays = week.days.map((day, di) => {
      if (di !== swapTarget.dayIndex) return day
      return {
        ...day,
        movements: day.movements.map((m, mi) => mi === swapTarget.movementIndex ? newMovement : m),
      }
    })

    const { error } = await supabase
      .from('coach_program_weeks')
      .update({ days: updatedDays })
      .eq('id', swapTarget.weekId)

    if (error) {
      setSwapError(error.message)
      setSwapping(false)
      return
    }

    // Update local state
    setWeeks(prev => prev.map(w => w.id === swapTarget.weekId ? { ...w, days: updatedDays } : w))
    setSwapTarget(null)
    setSwapping(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function exportPDF() {
    const trainingDayCount = weeks.flatMap(w => w.days.filter(d => d.type !== 'rest')).length
    const exerciseCount = weeks.flatMap(w => w.days.flatMap(d => d.movements)).filter(m => m !== 'Full rest').length

    const weeksHtml = weeks.map(week => {
      const daysHtml = week.days.map(day => {
        if (day.type === 'rest') {
          return `<div class="day rest"><span class="day-label">${day.day}</span><span class="day-title dimmed">Rest Day</span></div>`
        }
        const movementsHtml = day.movements.map(m => `<li>${m}</li>`).join('')
        return `
          <div class="day">
            <div class="day-header">
              <span class="day-label">${day.day}</span>
              <span class="day-title">${day.label}</span>
              ${day.focus ? `<span class="day-focus">${day.focus}</span>` : ''}
              ${day.duration && day.duration !== '—' ? `<span class="day-duration">${day.duration}</span>` : ''}
            </div>
            <ul class="movements">${movementsHtml}</ul>
          </div>`
      }).join('')

      return `
        <div class="week">
          <div class="week-header">
            <span class="week-label">${week.label || `Week ${week.week_number}`}</span>
            ${week.phase ? `<span class="week-phase">${week.phase}</span>` : ''}
          </div>
          <div class="days">${daysHtml}</div>
          ${week.coach_notes ? `<div class="coach-notes"><strong>Coach notes:</strong> ${week.coach_notes}</div>` : ''}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${program!.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11pt; color: #111; background: #fff; padding: 32px; }
    .doc-header { border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 24px; }
    .brand { font-size: 9pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 6px; }
    h1 { font-size: 22pt; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 8px; }
    .meta { font-size: 9pt; color: #555; display: flex; gap: 18px; flex-wrap: wrap; }
    .meta span::before { content: ''; }
    .week { margin-bottom: 28px; page-break-inside: avoid; }
    .week-header { display: flex; align-items: center; gap: 10px; background: #f4f4f4; padding: 7px 12px; border-radius: 6px; margin-bottom: 8px; }
    .week-label { font-size: 10pt; font-weight: 800; }
    .week-phase { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #555; background: #e0e0e0; padding: 2px 8px; border-radius: 10px; }
    .days { display: flex; flex-direction: column; gap: 5px; }
    .day { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 7px; }
    .day.rest { flex-direction: row; align-items: center; gap: 10px; opacity: 0.45; }
    .day-header { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .day-label { font-size: 8pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.07em; color: #888; min-width: 24px; }
    .day-title { font-size: 10pt; font-weight: 700; }
    .day-title.dimmed { color: #aaa; font-weight: 600; }
    .day-focus { font-size: 8.5pt; color: #666; }
    .day-duration { font-size: 8pt; color: #888; background: #f0f0f0; padding: 1px 7px; border-radius: 10px; margin-left: auto; }
    .movements { list-style: none; padding-left: 32px; display: flex; flex-direction: column; gap: 1px; }
    .movements li { font-size: 9.5pt; color: #333; }
    .movements li::before { content: '• '; color: #aaa; }
    .coach-notes { margin-top: 6px; font-size: 9pt; color: #555; padding: 7px 10px; background: #fafafa; border-left: 3px solid #ccc; border-radius: 3px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 8pt; color: #aaa; }
    @media print {
      body { padding: 20px; }
      .week { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="brand">Training Program</div>
    <h1>${program!.name}</h1>
    <div class="meta">
      <span>${program!.weeks_total} week${program!.weeks_total !== 1 ? 's' : ''}</span>
      <span>${trainingDayCount} training day${trainingDayCount !== 1 ? 's' : ''}</span>
      <span>${exerciseCount} exercises</span>
      <span>Generated ${formatDate(program!.created_at)}</span>
    </div>
  </div>
  ${weeksHtml}
  <div class="footer">Exported from Coach Portal · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading program…</div>

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
    <div className="coach-page" style={{ maxWidth: 1100 }}>
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
      <div className="coach-page-header" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Atlas Prime</div>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                autoFocus
                style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--text)', padding: '4px 10px', minWidth: 280, maxWidth: 500 }} />
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
          <button
            onClick={exportPDF}
            style={{ padding: '8px 18px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Export PDF
          </button>
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

      {/* Platform Sharing — admin only */}
      {isAdmin && (
        <div style={{ marginBottom: 28, padding: '16px 20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>Platform Sharing</p>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Makes this program visible in users' My Programs tab</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {(['admin', 'ff'] as const).map(role => {
              const active = sharedRoles.includes(role)
              return (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  disabled={sharingLoading}
                  style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? '#22c55e' : 'var(--border)'}`, background: active ? 'rgba(34,197,94,0.12)' : 'var(--surface2)', color: active ? '#22c55e' : 'var(--text-dim)', cursor: sharingLoading ? 'default' : 'pointer' }}
                >
                  {active ? '✓ ' : ''}{role === 'ff' ? 'Friends & Family (ff)' : 'Admin'}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={seedExercises}
              disabled={seedingExercises}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 12, cursor: seedingExercises ? 'default' : 'pointer', fontWeight: 700 }}
            >
              {seedingExercises ? 'Seeding…' : '🎬  Seed Exercises → Library'}
            </button>
            {seedResult !== null && (
              <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
                ✓ {seedResult.seeded} new · {seedResult.queued} queued · {seedResult.updated} labeled — go run Video Curation, program lane will appear
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <button
              onClick={generateDetails}
              disabled={genDetails}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', fontSize: 12, cursor: genDetails ? 'default' : 'pointer', fontWeight: 700 }}
            >
              {genDetails ? 'Generating…' : '🧠  Generate Instructions (AI)'}
            </button>
            {detailsResult !== null && (
              <span style={{ fontSize: 12, color: detailsResult.remaining > 0 ? 'var(--accent)' : '#22c55e', fontWeight: 700 }}>
                ✓ {detailsResult.generated} written
                {detailsResult.remaining > 0 ? ` · ${detailsResult.remaining} left — click again` : ' · all exercises covered 🎉'}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
            Seeding adds exercises to the library so video curation + cues can run. <strong>Generate Instructions</strong> writes the How-to / Breathing / Core / Common-Mistakes for every exercise (athletes see these on their coached calendar). For videos, run Admin → Video Curation (the program lane appears after seeding).
          </p>
        </div>
      )}

      {program.notes && (
        <div style={{ marginBottom: 28, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 720, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
          {program.notes}
        </div>
      )}

      {/* Import to library + editing hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          onClick={importToLibrary}
          disabled={importing}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: importing ? 'default' : 'pointer', fontFamily: 'inherit' }}
        >
          {importing ? 'Importing…' : '📥 Import exercises to my Library'}
        </button>
        {importResult !== null && (
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
            ✓ {importResult.imported} added to your Library{importResult.imported === 0 ? ' (all already there)' : ' — cues pre-filled'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
        Hover any exercise for <strong style={{ color: 'var(--text)' }}>✎ Cues</strong> (edit instructions here) or <strong style={{ color: 'var(--text)' }}>↔ Swap</strong> (replace it).
      </div>

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

                      {/* Movements with swap buttons */}
                      {day.type !== 'rest' && day.movements.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {day.movements.map((m, mi) => {
                            const key = `${week.id}-${di}-${mi}`
                            const hovered = hoveredMovement === key
                            return (
                              <div
                                key={mi}
                                onMouseEnter={() => setHoveredMovement(key)}
                                onMouseLeave={() => setHoveredMovement(null)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 0', borderRadius: 6 }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--text-dim)', paddingLeft: 36 }}>• {m}</span>
                                {hovered && (
                                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button
                                      onClick={() => openCues(m)}
                                      style={{ padding: '2px 8px', background: 'var(--surface2)', color: 'var(--text-mid)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      ✎ Cues
                                    </button>
                                    <button
                                      onClick={() => openSwap(week.id, di, mi, m)}
                                      style={{ padding: '2px 8px', background: 'var(--accent)18', color: 'var(--accent)', border: '1px solid var(--accent)40', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      ↔ Swap
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
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
        <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-dim)', fontSize: 14 }}>No weeks found for this program.</div>
      )}

      {/* ── Swap Modal ──────────────────────────────────────────────────────── */}
      {swapTarget && (
        <div
          onClick={e => { if (e.target === e.currentTarget && !swapping) setSwapTarget(null) }}
          style={{ position: 'fixed', inset: 0, background: '#00000085', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Swap Exercise</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Replacing: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{swapTarget.current}</span>
                </div>
              </div>
              <button onClick={() => setSwapTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4, flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* Search library */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                Search exercise library
              </label>
              <input
                value={swapSearch}
                onChange={e => handleSwapSearchChange(e.target.value)}
                placeholder="e.g. Leg Press, Romanian Deadlift…"
                autoFocus
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {/* Library results */}
            {swapSearching && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>Searching…</div>
            )}
            {!swapSearching && swapResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>From library</div>
                {swapResults.map(r => (
                  <button
                    key={r.name_normalized}
                    onClick={() => confirmSwap(r.name_display)}
                    disabled={swapping}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, cursor: swapping ? 'not-allowed' : 'pointer', textAlign: 'left', width: '100%', gap: 2, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { if (!swapping) e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.name_display}</span>
                    {r.tip && <span style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>{r.tip}</span>}
                  </button>
                ))}
              </div>
            )}
            {!swapSearching && swapSearch.length > 1 && swapResults.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
                Not in library — use the custom field below.
              </div>
            )}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>or enter custom</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Custom exercise */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={customSwap}
                onChange={e => setCustomSwap(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customSwap.trim()) confirmSwap(customSwap.trim()) }}
                placeholder="Type any exercise name…"
                style={{ flex: 1, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14 }}
              />
              <button
                onClick={() => customSwap.trim() && confirmSwap(customSwap.trim())}
                disabled={!customSwap.trim() || swapping}
                style={{ padding: '10px 16px', background: customSwap.trim() ? 'var(--accent)' : 'var(--surface2)', color: customSwap.trim() ? '#fff' : 'var(--text-dim)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: customSwap.trim() && !swapping ? 'pointer' : 'not-allowed', flexShrink: 0 }}
              >
                {swapping ? '…' : 'Use'}
              </button>
            </div>

            {swapError && (
              <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13 }}>
                {swapError}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Sets/reps from the original exercise are preserved automatically.
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Modal ────────────────────────────────────────────────────── */}
      {showAssign && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowAssign(false) }}
          style={{ position: 'fixed', inset: 0, background: '#00000080', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Assign to Client</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{program.name}</div>
              </div>
              <button onClick={() => setShowAssign(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {assignSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 40 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{assignSuccess}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => { setAssignSuccess(''); setSelectedClient(null); setAssignSearch(''); setAssignResults([]) }}
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
                {!selectedClient && (
                  <button
                    onClick={() => { setSelectedClient({ id: user!.id, name: 'Myself', role: 'coach' }); setAssignSearch(''); setAssignResults([]) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)22', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      💪
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Assign to myself</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Run this program as your own training</div>
                    </div>
                  </button>
                )}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Search by name</label>
                  <input value={assignSearch} onChange={e => handleAssignSearchChange(e.target.value)} placeholder="Type a client's name…" autoFocus
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                {assignSearching && <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>Searching…</div>}
                {!assignSearching && assignResults.length > 0 && !selectedClient && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assignResults.map(r => (
                      <button key={r.id} onClick={() => setSelectedClient(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)22', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
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
                {selectedClient && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--accent)12', border: '1px solid var(--accent)40', borderRadius: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)22', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                      {(selectedClient.name ?? '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedClient.name ?? 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Selected</div>
                    </div>
                    <button onClick={() => { setSelectedClient(null); setAssignSearch(''); setAssignResults([]); setReplaceWarning(null) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Start date</label>
                  <input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)}
                    style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, colorScheme: 'dark' }} />
                </div>
                {assignError && (
                  <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13 }}>{assignError}</div>
                )}
                {replaceWarning ? (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>
                      ⚠️ Already on a program
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 12 }}>
                      {selectedClient?.id === user?.id ? 'You are' : `${selectedClient?.name ?? 'This client'} is`} currently on <strong>{replaceWarning.programName}</strong> (started {new Date(replaceWarning.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}).
                      Assigning <strong>{program.name}</strong> will replace it as the active program. All logged workouts and completed days are kept — to return to the old program later, just re-assign it (backdate the start date to pick up where it left off).
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleAssign()} disabled={assigning}
                        style={{ flex: 1, padding: '11px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: assigning ? 0.6 : 1 }}>
                        {assigning ? 'Replacing…' : 'Replace Program'}
                      </button>
                      <button onClick={() => setReplaceWarning(null)} disabled={assigning}
                        style={{ flex: 1, padding: '11px 16px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => handleAssign()} disabled={!selectedClient || assigning}
                    style={{ padding: '12px 24px', background: selectedClient ? 'var(--accent)' : 'var(--surface2)', color: selectedClient ? '#fff' : 'var(--text-dim)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: selectedClient && !assigning ? 'pointer' : 'not-allowed', opacity: assigning ? 0.6 : 1 }}>
                    {assigning ? 'Assigning…' : selectedClient ? `Assign to ${selectedClient.name ?? 'client'}` : 'Select a client first'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* In-place instruction editor (Part B) */}
      {cuesTarget && (
        <div onClick={() => !cuesBusy && setCuesTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Coaching Instructions</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 0' }}>{cuesTarget.name}</h3>
              </div>
              <button onClick={() => setCuesTarget(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>
              Saved to your Library and shown to every athlete on any program using this exercise.
            </p>
            <CoachInstructionFields value={cues} onChange={patch => setCues(c => ({ ...c, ...patch }))} exerciseName={cuesTarget.name} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={saveCues} disabled={cuesBusy}
                style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: cuesBusy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: cuesBusy ? 0.6 : 1 }}>
                {cuesBusy ? 'Saving…' : 'Save Instructions'}
              </button>
              <button onClick={() => setCuesTarget(null)} disabled={cuesBusy}
                style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
