'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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

interface ParsedWeek {
  week_number: number
  label: string
  phase: string | null
  days: ParsedDay[]
}

interface ParsedProgram {
  title: string
  description: string
  weeks_total: number
  weeks: ParsedWeek[]
  raw_text?: string
}

interface Change {
  week: number
  day: string
  original: string
  replacement: string
  reason: string
}

type Step = 'upload' | 'processing' | 'preview' | 'saving' | 'done'

export default function ImportProgramPage() {
  const { user } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [usedVision, setUsedVision] = useState(false)
  const [program, setProgram] = useState<ParsedProgram | null>(null)
  const [programTitle, setProgramTitle] = useState('')
  const [changes, setChanges] = useState<Change[]>([])
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [error, setError] = useState('')
  const [activateNow, setActivateNow] = useState(true)

  async function handleFile(file: File) {
    setFileName(file.name)
    setError('')
    setStep('processing')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expired — please refresh.'); setStep('upload'); return }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/user/import-program', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      setProgram(data.program)
      setProgramTitle(data.program.title)
      setChanges(data.changes ?? [])
      setUsedVision(data.usedVision ?? false)
      setExpandedWeeks(new Set([1]))
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setStep('upload')
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  function toggleWeek(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  // Find changes for a specific exercise in a specific day/week
  function changesFor(weekNum: number, dayAbbr: string, movement: string): Change | undefined {
    return changes.find(c =>
      c.week === weekNum &&
      c.day === dayAbbr &&
      (c.replacement === movement || c.original === movement)
    )
  }

  async function handleSave(activate: boolean) {
    if (!program || !user) return
    setStep('saving')
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expired.'); setStep('preview'); return }

    const { data: prog, error: progErr } = await supabase
      .from('user_imported_programs')
      .insert({
        user_id: user.id,
        name: programTitle.trim() || program.title,
        source_filename: fileName,
        weeks_total: program.weeks_total,
        status: activate ? 'active' : 'draft',
        raw_text: program.raw_text ?? null,
        notes: program.description,
      })
      .select('id')
      .single()

    if (progErr || !prog) { setError(progErr?.message ?? 'Save failed'); setStep('preview'); return }

    const weekRows = program.weeks.map(w => ({
      program_id: prog.id,
      week_number: w.week_number,
      label: w.label || `Week ${w.week_number}`,
      phase: w.phase ?? null,
      days: w.days,
    }))

    const { error: weeksErr } = await supabase.from('user_imported_program_weeks').insert(weekRows)
    if (weeksErr) { setError(weeksErr.message); setStep('preview'); return }

    if (activate) {
      await supabase
        .from('profiles')
        .update({ active_imported_program_id: prog.id, imported_program_current_week: 1 })
        .eq('id', user.id)
    }

    setStep('done')
  }

  const trainingDays = program?.weeks.flatMap(w => w.days.filter(d => d.type !== 'rest')).length ?? 0

  // ── Upload step ─────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div style={{ padding: '32px 20px 80px', maxWidth: 600, margin: '0 auto' }}>
        <button onClick={() => router.back()}
          style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back
        </button>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Bring Your Own Program
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            Import a Program
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
            Have a program from a trainer, an app, or a PDF you've collected over the years? Upload it and we'll rebuild it inside Move., safety-checked against your profile.
          </p>
        </div>

        {error && (
          <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 16,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'var(--surface2)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Drop your program here</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>PDF or DOCX — text-based or scanned</div>
          <div style={{
            display: 'inline-block',
            padding: '9px 22px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
          }}>
            Choose File
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={onFileInput} />

        {/* What happens */}
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '🔍', title: 'We read your program', desc: 'Text-based PDFs parse in seconds. Scanned or image PDFs use AI vision.' },
            { icon: '🛡️', title: 'Safety-checked for you', desc: 'Exercises are reviewed against your injury restrictions and profile before you see the preview.' },
            { icon: '📋', title: 'You review before activating', desc: 'See exactly what was changed and why — you stay in control.' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 14, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Processing step ─────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20, padding: 40 }}>
        <div style={{ fontSize: 40 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Reading {fileName}…</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
          Extracting your program and running a safety check against your profile. This takes 15–45 seconds.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }`}</style>
      </div>
    )
  }

  // ── Done step ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{activateNow ? 'Program activated!' : 'Program saved!'}</div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', maxWidth: 320, lineHeight: 1.6 }}>
          {activateNow
            ? `${programTitle} is now your active program. Head to your calendar to see it.`
            : `${programTitle} is saved in your library. Activate it any time from the menu.`}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {activateNow && (
            <button onClick={() => router.push('/today')}
              style={{ padding: '11px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Go to Today
            </button>
          )}
          <button onClick={() => { setStep('upload'); setProgram(null); setChanges([]); setFileName('') }}
            style={{ padding: '11px 24px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Import Another
          </button>
        </div>
      </div>
    )
  }

  // ── Preview step ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 20px 100px', maxWidth: 760, margin: '0 auto' }}>
      <button onClick={() => { setStep('upload'); setProgram(null); setChanges([]); setFileName('') }}
        style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← Upload different file
      </button>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Review Your Program
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          Looks good — confirm and save
        </h1>
        {usedVision && (
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 4 }}>
            📷 This was a scanned PDF — read via AI vision
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Program title editable */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Program Name</label>
        <input
          value={programTitle}
          onChange={e => setProgramTitle(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontWeight: 600, boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Weeks', value: program!.weeks_total },
          { label: 'Training Days', value: trainingDays },
          { label: 'Source', value: fileName },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Safety changes summary */}
      {changes.length > 0 && (
        <div style={{ marginBottom: 24, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            🛡️ {changes.length} exercise{changes.length !== 1 ? 's' : ''} adjusted for your profile
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
            These were modified based on your injury restrictions. The originals are shown struck-through in the preview below.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {changes.map((c, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: '#ef4444', textDecoration: 'line-through', marginRight: 6 }}>{c.original}</span>
                <span style={{ color: '#22c55e', marginRight: 6 }}>→ {c.replacement}</span>
                <span style={{ color: 'var(--text-dim)' }}>({c.reason})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {program!.weeks.map(week => {
          const open = expandedWeeks.has(week.week_number)
          const workoutCount = week.days.filter(d => d.type !== 'rest').length
          return (
            <div key={week.week_number} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => toggleWeek(week.week_number)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{week.label || `Week ${week.week_number}`}</span>
                  {week.phase && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent)18', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{week.phase}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{workoutCount} training days</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                </div>
              </button>
              {open && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {week.days.map((day, di) => (
                    <div key={di} style={{ background: day.type === 'rest' ? 'transparent' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', opacity: day.type === 'rest' ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: day.type === 'rest' ? 0 : 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--accent)', minWidth: 26 }}>{day.day}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{day.label || (day.type === 'rest' ? 'Rest Day' : 'Training')}</span>
                        {day.focus && day.type !== 'rest' && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.focus}</span>}
                        {day.duration && day.duration !== '—' && (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '1px 7px', borderRadius: 20 }}>{day.duration}</span>
                        )}
                      </div>
                      {day.type !== 'rest' && day.movements.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 28 }}>
                          {day.movements.map((m, mi) => {
                            const change = changesFor(week.week_number, day.day, m)
                            const wasReplaced = changes.some(c => c.week === week.week_number && c.day === day.day && c.replacement === m)
                            return (
                              <div key={mi} style={{ fontSize: 12, color: wasReplaced ? '#22c55e' : 'var(--text-dim)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span>• {m}</span>
                                {wasReplaced && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✓ adjusted</span>}
                                {change && change.original === m && <span style={{ fontSize: 10, color: '#ef4444', textDecoration: 'line-through' }}></span>}
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

      {/* Save actions */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', zIndex: 50 }}>
        <button
          onClick={() => { setActivateNow(true); handleSave(true) }}
          disabled={step === 'saving'}
          style={{ flex: 1, minWidth: 160, padding: '13px', background: step === 'saving' ? 'var(--surface2)' : 'var(--accent)', color: step === 'saving' ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: step === 'saving' ? 'not-allowed' : 'pointer' }}
        >
          {step === 'saving' ? 'Saving…' : '⚡ Activate Program'}
        </button>
        <button
          onClick={() => { setActivateNow(false); handleSave(false) }}
          disabled={step === 'saving'}
          style={{ flex: 1, minWidth: 140, padding: '13px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: step === 'saving' ? 'not-allowed' : 'pointer' }}
        >
          💾 Save for Later
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
