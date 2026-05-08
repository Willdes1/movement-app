'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Step = 'pick' | 'uploading' | 'preview' | 'saving' | 'saved'

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

export default function CoachBuilderPage() {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('pick')
  const [program, setProgram] = useState<ParsedProgram | null>(null)
  const [programTitle, setProgramTitle] = useState('')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    setError('')
    setStep('uploading')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/coach/import-program', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      setProgram(data.program)
      setProgramTitle(data.program.title)
      setExpandedWeeks(new Set([1]))
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setStep('pick')
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

  async function handleSave() {
    if (!program || !user) return
    setStep('saving')
    setError('')

    const { data: prog, error: progErr } = await supabase
      .from('coach_programs')
      .insert({
        coach_id: user.id,
        name: programTitle || program.title,
        source: 'import',
        import_filename: fileName,
        weeks_total: program.weeks_total,
        status: 'draft',
        raw_text: program.raw_text,
        notes: program.description,
      })
      .select('id')
      .single()

    if (progErr || !prog) {
      setError(progErr?.message || 'Failed to save program')
      setStep('preview')
      return
    }

    const weekRows = program.weeks.map(w => ({
      program_id: prog.id,
      week_number: w.week_number,
      label: w.label,
      phase: w.phase ?? null,
      days: w.days,
      coach_notes: '',
    }))

    const { error: weeksErr } = await supabase.from('coach_program_weeks').insert(weekRows)

    if (weeksErr) {
      setError(weeksErr.message)
      setStep('preview')
      return
    }

    setStep('saved')
  }

  const trainingDays = program?.weeks.flatMap(w => w.days.filter(d => d.type !== 'rest')).length ?? 0
  const totalExercises = program?.weeks.flatMap(w => w.days.flatMap(d => d.movements)).filter(m => m !== 'Full rest').length ?? 0

  // ── Pick step ──────────────────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Coach Portal
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Program Builder</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Create, import, and AI-generate training programs for your clients.</p>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* AI Generate — disabled */}
          <div style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 20px', opacity: 0.55, cursor: 'not-allowed' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>AI Generate</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Two-agent pipeline — Planner + Filler</div>
          </div>

          {/* Import PDF/DOCX — active */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '2px solid var(--accent)', borderRadius: 14, padding: '24px 20px', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Import PDF/DOCX</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Parse an existing program from a file</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Click to upload ↗</div>
          </div>

          {/* Build Manually — disabled */}
          <div style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 20px', opacity: 0.55, cursor: 'not-allowed' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✏️</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Build Manually</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Drag-and-drop week/day builder</div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={onFileInput} />

        {error && (
          <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Drop zone hint */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '28px 24px',
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: 13,
            transition: 'border-color 0.15s, background 0.15s',
            background: dragging ? 'var(--surface2)' : 'transparent',
            cursor: 'pointer',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>⬆️</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Drop a PDF or DOCX here</div>
          <div>or click the Import card above — AI will parse and structure it automatically</div>
        </div>
      </div>
    )
  }

  // ── Uploading step ─────────────────────────────────────────────────────────
  if (step === 'uploading') {
    return (
      <div style={{ padding: '40px', maxWidth: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20 }}>
        <div style={{ fontSize: 40 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Parsing {fileName}…</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 400 }}>
          Extracting text and running it through the AI normalizer. This usually takes 10–20 seconds.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }`}</style>
      </div>
    )
  }

  // ── Saved step ─────────────────────────────────────────────────────────────
  if (step === 'saved') {
    return (
      <div style={{ padding: '40px', maxWidth: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, minHeight: 400, justifyContent: 'center' }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Program saved as draft</div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>
          <strong style={{ color: 'var(--text)' }}>{programTitle}</strong> — {program?.weeks_total} week{program?.weeks_total !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => { setStep('pick'); setProgram(null); setError(''); setFileName('') }}
          style={{ marginTop: 8, padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Import Another Program
        </button>
      </div>
    )
  }

  // ── Preview + Saving step ──────────────────────────────────────────────────
  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button
            onClick={() => { setStep('pick'); setProgram(null); setError('') }}
            style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back
          </button>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Import Preview
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Review &amp; Save Program</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={step === 'saving'}
          style={{
            padding: '12px 28px',
            background: step === 'saving' ? 'var(--surface2)' : 'var(--accent)',
            color: step === 'saving' ? 'var(--text-dim)' : '#fff',
            border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14,
            cursor: step === 'saving' ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {step === 'saving' ? 'Saving…' : 'Save as Draft'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Program title */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
          Program Title
        </label>
        <input
          value={programTitle}
          onChange={e => setProgramTitle(e.target.value)}
          style={{ width: '100%', maxWidth: 520, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontWeight: 600, boxSizing: 'border-box' }}
        />
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Weeks', value: program?.weeks_total },
          { label: 'Training Days', value: trainingDays },
          { label: 'Exercises', value: totalExercises },
          { label: 'Source', value: fileName },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {program?.description && (
        <div style={{ marginBottom: 24, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 680 }}>
          {program.description}
        </div>
      )}

      {/* Week accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {program?.weeks.map(week => {
          const open = expandedWeeks.has(week.week_number)
          const workoutDays = week.days.filter(d => d.type !== 'rest')
          return (
            <div key={week.week_number} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.week_number)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}
              >
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

              {/* Week body */}
              {open && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {week.days.map((day, di) => (
                    <div key={di} style={{
                      background: day.type === 'rest' ? 'transparent' : 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      opacity: day.type === 'rest' ? 0.5 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: day.type === 'rest' ? 0 : 8, gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', minWidth: 28 }}>{day.day}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{day.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {day.focus && day.type !== 'rest' && (
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.focus}</span>
                          )}
                          {day.duration && day.duration !== '—' && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 20 }}>{day.duration}</span>
                          )}
                        </div>
                      </div>
                      {day.type !== 'rest' && day.movements.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {day.movements.map((m, mi) => (
                            <div key={mi} style={{ fontSize: 12, color: 'var(--text-dim)', paddingLeft: 36 }}>
                              • {m}
                            </div>
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

      {/* Bottom save */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={step === 'saving'}
          style={{
            padding: '12px 32px',
            background: step === 'saving' ? 'var(--surface2)' : 'var(--accent)',
            color: step === 'saving' ? 'var(--text-dim)' : '#fff',
            border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14,
            cursor: step === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          {step === 'saving' ? 'Saving…' : 'Save as Draft'}
        </button>
      </div>
    </div>
  )
}
