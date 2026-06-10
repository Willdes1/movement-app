'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import ManualProgramBuilder from '@/components/coach/ManualProgramBuilder'

type Step = 'pick' | 'brief' | 'generating-ai' | 'uploading' | 'preview' | 'saving' | 'saved' | 'manual'
type GenerationSource = 'import' | 'ai'

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

interface BriefForm {
  name: string
  sport: string
  goal: string
  level: string
  weeks_total: number
  days_per_week: number
  session_length: string
  equipment: string[]
  restrictions: string
  notes: string
}

interface Template {
  id: string
  name: string
  weeks_total: number
  brief: BriefForm | null
}

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbells', 'Cables', 'Machines', 'Kettlebells',
  'Resistance Bands', 'Pull-up Bar', 'Dip Bars', 'Bodyweight',
]

const LEVEL_OPTIONS = [
  { value: 'beginner',     label: 'Beginner',     sub: '< 1 year' },
  { value: 'intermediate', label: 'Intermediate', sub: '1–3 years' },
  { value: 'expert',       label: 'Expert',       sub: '3–5 years' },
  { value: 'elite',        label: 'Elite',        sub: 'Competitive' },
  { value: 'pro',          label: 'Pro',          sub: 'Professional' },
]

const defaultBrief: BriefForm = {
  name: '', sport: '', goal: '', level: 'intermediate',
  weeks_total: 8, days_per_week: 4, session_length: '60 min',
  equipment: ['Barbell', 'Dumbbells'], restrictions: '', notes: '',
}

export default function CoachBuilderPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('pick')
  const [source, setSource] = useState<GenerationSource>('import')
  const [program, setProgram] = useState<ParsedProgram | null>(null)
  const [programTitle, setProgramTitle] = useState('')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // AI generate brief state
  const [brief, setBrief] = useState<BriefForm>(defaultBrief)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Save options
  const [savedProgramId, setSavedProgramId] = useState<string | null>(null)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  // Load templates when brief step opens
  useEffect(() => {
    if (step === 'brief' && user) fetchTemplates()
  }, [step, user])

  async function fetchTemplates() {
    setTemplatesLoading(true)
    const { data } = await supabase
      .from('coach_programs')
      .select('id, name, weeks_total, brief')
      .eq('coach_id', user!.id)
      .eq('is_template', true)
      .order('created_at', { ascending: false })
      .limit(6)
    setTemplates((data ?? []) as Template[])
    setTemplatesLoading(false)
  }

  // ── Import flow ──────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setFileName(file.name)
    setError('')
    setSource('import')
    setStep('uploading')

    const formData = new FormData()
    formData.append('file', file)
    if (user?.id) formData.append('coachId', user.id)

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

  // ── AI generate flow ─────────────────────────────────────────────────────
  function toggleEquipment(item: string) {
    setBrief(prev => ({
      ...prev,
      equipment: prev.equipment.includes(item)
        ? prev.equipment.filter(e => e !== item)
        : [...prev.equipment, item],
    }))
  }

  async function handleGenerate() {
    setError('')
    setSource('ai')
    setStep('generating-ai')

    try {
      const res = await fetch('/api/coach/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...brief, coachId: user?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setProgram(data.program)
      setProgramTitle(data.program.title)
      setExpandedWeeks(new Set([1]))
      setSaveAsTemplate(false)
      setTemplateSaved(false)
      setSavedProgramId(null)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate program')
      setStep('brief')
    }
  }

  function useTemplate(template: Template) {
    setProgram({
      title: template.name,
      description: '',
      weeks_total: template.weeks_total,
      weeks: [],
    } as unknown as ParsedProgram)
    router.push(`/coach/programs/${template.id}`)
  }

  // ── Shared save flow ─────────────────────────────────────────────────────
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired — please refresh the page and try again.')
      setStep('preview')
      return
    }

    const { data: prog, error: progErr } = await supabase
      .from('coach_programs')
      .insert({
        coach_id:        session.user.id,
        name:            programTitle || program.title,
        source:          source === 'ai' ? 'ai_generated' : 'import',
        import_filename: source === 'import' ? fileName : null,
        weeks_total:     program.weeks_total,
        status:          'draft',
        raw_text:        program.raw_text ?? null,
        notes:           program.description,
        brief:           source === 'ai' ? brief : null,
        is_template:     false,
      })
      .select('id')
      .single()

    if (progErr || !prog) {
      setError(progErr?.message || 'Failed to save program')
      setStep('preview')
      return
    }

    setSavedProgramId(prog.id)

    const weekRows = program.weeks.map(w => ({
      program_id:  prog.id,
      week_number: w.week_number,
      label:       w.label,
      phase:       w.phase ?? null,
      days:        w.days,
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

  async function handleSaveAsTemplate() {
    if (!savedProgramId) return
    setSavingTemplate(true)
    const { error } = await supabase
      .from('coach_programs')
      .update({ is_template: true })
      .eq('id', savedProgramId)
    setSavingTemplate(false)
    if (!error) setTemplateSaved(true)
  }

  const trainingDays = program?.weeks.flatMap(w => w.days.filter(d => d.type !== 'rest')).length ?? 0
  const totalExercises = program?.weeks.flatMap(w => w.days.flatMap(d => d.movements)).filter(m => m !== 'Full rest').length ?? 0

  // ── Manual build step ────────────────────────────────────────────────────
  if (step === 'manual') {
    return (
      <ManualProgramBuilder
        coachId={user!.id}
        onBack={() => setStep('pick')}
        onSaved={(id) => { setSavedProgramId(id); setSource('import'); setStep('saved') }}
      />
    )
  }

  // ── Pick step ────────────────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <div className="coach-page" style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Atlas Prime</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Program Builder</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Create, import, and AI-generate training programs for your clients.</p>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* AI Generate — now active */}
          <div
            onClick={() => { setError(''); setBrief(defaultBrief); setStep('brief') }}
            style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '2px solid var(--accent)', borderRadius: 14, padding: '24px 20px', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>AI Generate</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Brief the AI — full program in ~30 seconds</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fill brief ↗</div>
          </div>

          {/* Import PDF/DOCX */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '2px solid var(--border)', borderRadius: 14, padding: '24px 20px', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Import PDF/DOCX</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Parse an existing program from a file</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Click to upload ↗</div>
          </div>

          {/* Build Manually */}
          <div
            onClick={() => { setError(''); setStep('manual') }}
            style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '2px solid var(--border)', borderRadius: 14, padding: '24px 20px', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>✏️</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Build Manually</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Drag-and-drop week/day builder</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Start building ↗</div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={onFileInput} />

        {error && (
          <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: '28px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, transition: 'border-color 0.15s, background 0.15s', background: dragging ? 'var(--surface2)' : 'transparent', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>⬆️</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Drop a PDF or DOCX here</div>
          <div>or click the Import card above</div>
        </div>
      </div>
    )
  }

  // ── Brief step (AI Generate form) ────────────────────────────────────────
  if (step === 'brief') {
    const canGenerate = brief.sport.trim().length > 0 && brief.goal.trim().length > 0
    return (
      <div className="coach-page" style={{ maxWidth: 760 }}>
        <button onClick={() => setStep('pick')}
          style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back
        </button>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>AI Generate</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Brief the AI</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>Fill in your client's profile and the AI will build a complete program in ~30 seconds.</p>
        </div>

        {error && (
          <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Template library */}
        {templates.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              📚 Your Template Library — use one instead of generating fresh
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {t.weeks_total}w
                      {t.brief ? ` · ${t.brief.sport} · ${t.brief.level} · ${t.brief.days_per_week}d/wk` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => useTemplate(t)}
                    style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }} />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12 }}>Or fill the brief below to generate a new program:</div>
          </div>
        )}
        {templatesLoading && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Loading your library…</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Program name */}
          <div>
            <label style={labelStyle}>Program Name <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional — AI will name it if blank)</span></label>
            <input value={brief.name} onChange={e => setBrief(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. MMA Off-Season Strength Block"
              style={inputStyle} />
          </div>

          {/* Sport + Goal */}
          <div className="coach-grid-2" style={{ gap: 16 }}>
            <div>
              <label style={labelStyle}>Sport / Activity <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={brief.sport} onChange={e => setBrief(p => ({ ...p, sport: e.target.value }))}
                placeholder="e.g. MMA, CrossFit, Soccer, Golf…"
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Primary Goal <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={brief.goal} onChange={e => setBrief(p => ({ ...p, goal: e.target.value }))}
                placeholder="e.g. Build explosive strength, fat loss…"
                style={inputStyle} />
            </div>
          </div>

          {/* Duration + Days + Session */}
          <div className="coach-grid-3" style={{ gap: 16 }}>
            <div>
              <label style={labelStyle}>Program Length</label>
              <select value={brief.weeks_total} onChange={e => setBrief(p => ({ ...p, weeks_total: Number(e.target.value) }))} style={selectStyle}>
                {[4, 6, 8, 12].map(w => <option key={w} value={w}>{w} weeks</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Days / Week</label>
              <select value={brief.days_per_week} onChange={e => setBrief(p => ({ ...p, days_per_week: Number(e.target.value) }))} style={selectStyle}>
                {[3, 4, 5, 6].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Session Length</label>
              <select value={brief.session_length} onChange={e => setBrief(p => ({ ...p, session_length: e.target.value }))} style={selectStyle}>
                {['45 min', '60 min', '75 min', '90 min'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Experience level */}
          <div>
            <label style={labelStyle}>Experience Level</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LEVEL_OPTIONS.map(opt => {
                const active = brief.level === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setBrief(p => ({ ...p, level: opt.value }))}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent)' : 'var(--surface2)',
                      color: active ? '#fff' : 'var(--text)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {opt.label}
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.75 }}>{opt.sub}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label style={labelStyle}>Available Equipment</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EQUIPMENT_OPTIONS.map(item => {
                const active = brief.equipment.includes(item)
                return (
                  <button
                    key={item}
                    onClick={() => toggleEquipment(item)}
                    style={{
                      padding: '7px 13px', borderRadius: 8, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent)18' : 'var(--surface2)',
                      color: active ? 'var(--accent)' : 'var(--text-dim)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Restrictions + Notes */}
          <div className="coach-grid-2" style={{ gap: 16 }}>
            <div>
              <label style={labelStyle}>Injury / Restrictions <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
              <input value={brief.restrictions} onChange={e => setBrief(p => ({ ...p, restrictions: e.target.value }))}
                placeholder="e.g. Left knee, lower back…"
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Special Notes <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
              <input value={brief.notes} onChange={e => setBrief(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Competition in 8 weeks, prefers AM…"
                style={inputStyle} />
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              padding: '14px 32px', background: canGenerate ? 'var(--accent)' : 'var(--surface2)',
              color: canGenerate ? '#fff' : 'var(--text-dim)',
              border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15,
              cursor: canGenerate ? 'pointer' : 'not-allowed', marginTop: 4,
              alignSelf: 'flex-start',
            }}
          >
            Generate Program →
          </button>
          {!canGenerate && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: -14 }}>Fill in Sport and Goal to continue</div>
          )}
        </div>
      </div>
    )
  }

  // ── Generating (AI) step ─────────────────────────────────────────────────
  if (step === 'generating-ai') {
    return (
      <div className="coach-page" style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20 }}>
        <div style={{ fontSize: 40 }}>🤖</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Building your program…</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 400 }}>
          AI is generating a {brief.weeks_total}-week {brief.sport} program for a {brief.level} athlete. This usually takes 20–40 seconds.
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

  // ── Uploading (import) step ──────────────────────────────────────────────
  if (step === 'uploading') {
    return (
      <div className="coach-page" style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20 }}>
        <div style={{ fontSize: 40 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Parsing {fileName}…</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 400 }}>
          Extracting and analyzing your program. Text-based PDFs take 10–20 seconds. Image-based or scanned PDFs may take up to 40 seconds.
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

  // ── Saved step ───────────────────────────────────────────────────────────
  if (step === 'saved') {
    return (
      <div className="coach-page" style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20, minHeight: 400, justifyContent: 'center' }}>
        <div style={{ fontSize: 48, textAlign: 'center' }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}>Program saved as draft</div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center' }}>
          <strong style={{ color: 'var(--text)' }}>{programTitle}</strong> — {program?.weeks_total} week{program?.weeks_total !== 1 ? 's' : ''}
        </div>

        {/* Save to Library option (only for AI-generated programs) */}
        {source === 'ai' && savedProgramId && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📚 Save to My Library?</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              Save this program to your library for instant reuse with future clients.
            </div>
            {templateSaved ? (
              <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>✓ Saved to your library</div>
            ) : (
              <button
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate}
                style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: savingTemplate ? 0.6 : 1 }}
              >
                {savingTemplate ? 'Saving…' : 'Save to Library'}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button
            onClick={() => router.push('/coach/programs')}
            style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            View My Programs
          </button>
          <button
            onClick={() => {
              setStep(source === 'ai' ? 'brief' : 'pick')
              setProgram(null)
              setError('')
              setFileName('')
              setSavedProgramId(null)
              setTemplateSaved(false)
            }}
            style={{ padding: '10px 24px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            {source === 'ai' ? 'Generate Another' : 'Import Another'}
          </button>
        </div>
      </div>
    )
  }

  // ── Preview + Saving step ────────────────────────────────────────────────
  return (
    <div className="coach-page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button
            onClick={() => { setStep(source === 'ai' ? 'brief' : 'pick'); setProgram(null); setError('') }}
            style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back
          </button>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            {source === 'ai' ? 'AI Generate — Preview' : 'Import Preview'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Review &amp; Save Program</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={step === 'saving'}
          style={{ padding: '12px 28px', background: step === 'saving' ? 'var(--surface2)' : 'var(--accent)', color: step === 'saving' ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: step === 'saving' ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
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
        <label style={labelStyle}>Program Title</label>
        <input value={programTitle} onChange={e => setProgramTitle(e.target.value)}
          style={{ width: '100%', maxWidth: 520, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontWeight: 600, boxSizing: 'border-box' }} />
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Weeks', value: program?.weeks_total },
          { label: 'Training Days', value: trainingDays },
          { label: 'Exercises', value: totalExercises },
          { label: 'Source', value: source === 'ai' ? `AI · ${brief.sport}` : fileName },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {program?.description && (
        <div style={{ marginBottom: 24, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 680 }}>{program.description}</div>
      )}

      {/* Week accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {program?.weeks.map(week => {
          const open = expandedWeeks.has(week.week_number)
          const workoutDays = week.days.filter(d => d.type !== 'rest')
          return (
            <div key={week.week_number} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
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

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={step === 'saving'}
          style={{ padding: '12px 32px', background: step === 'saving' ? 'var(--surface2)' : 'var(--accent)', color: step === 'saving' ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: step === 'saving' ? 'not-allowed' : 'pointer' }}>
          {step === 'saving' ? 'Saving…' : 'Save as Draft'}
        </button>
      </div>
    </div>
  )
}

// Shared style helpers
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  boxSizing: 'border-box',
}
