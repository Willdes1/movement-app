'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Shared instruction editor — the 4 standard fields (auto-fillable free from the
// global library or AI-generated) + the coach's own custom fields. Used by the
// Coach Library modal AND the in-place editor on the program page so the two
// never drift apart.

export type Cues = {
  how: string
  breathing: string
  core: string
  tip: string
  custom_fields: { label: string; text: string }[]
}

export const BLANK_CUES: Cues = { how: '', breathing: '', core: '', tip: '', custom_fields: [] }

export const STANDARD_LABELS: Record<'how' | 'breathing' | 'core' | 'tip', string> = {
  how: 'How to Perform',
  breathing: 'Breathing',
  core: 'Core Engagement',
  tip: 'Common Mistakes',
}
export const DEFAULT_FIELD_ORDER: (keyof typeof STANDARD_LABELS)[] = ['how', 'breathing', 'core', 'tip']

// Match the global exercise_library key (strip sets/reps scheme, dashes → spaces).
function globalKey(name: string): string {
  return name
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim().toLowerCase().replace(/\s+/g, '_')
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
}

export default function CoachInstructionFields({ value, onChange, exerciseName }: {
  value: Cues
  onChange: (patch: Partial<Cues>) => void
  exerciseName: string
}) {
  const [autofilling, setAutofilling] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [note, setNote] = useState('')
  const [showManual, setShowManual] = useState(false)
  // Which standard fields to show + order — the coach's Field Template. Defaults
  // to all four. Resilient: any error (e.g. migration not run) → default.
  const [fieldOrder, setFieldOrder] = useState<(keyof typeof STANDARD_LABELS)[]>(DEFAULT_FIELD_ORDER)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('profiles').select('coach_field_template').eq('id', user.id).single()
        const tpl = data?.coach_field_template
        if (active && Array.isArray(tpl) && tpl.length) {
          setFieldOrder(tpl.filter((k: string): k is keyof typeof STANDARD_LABELS => k in STANDARD_LABELS))
        }
      } catch { /* default order */ }
    })()
    return () => { active = false }
  }, [])

  // Fill blanks for FREE from our global library (never overwrites the coach's own text).
  async function autofill() {
    if (!exerciseName.trim()) { setNote('Enter the exercise name first.'); return }
    setAutofilling(true); setNote('')
    const { data } = await supabase
      .from('exercise_library')
      .select('how, breathing, core, tip')
      .eq('name_normalized', globalKey(exerciseName))
      .single()
    if (data && (data.how || data.breathing || data.core || data.tip)) {
      onChange({
        how: value.how || data.how || '',
        breathing: value.breathing || data.breathing || '',
        core: value.core || data.core || '',
        tip: value.tip || data.tip || '',
      })
      setNote('Filled from the library — edit anything you like.')
    } else {
      setNote('Not in the library yet — try Generate with AI.')
    }
    setAutofilling(false)
  }

  async function generate() {
    if (!exerciseName.trim()) { setNote('Enter the exercise name first.'); return }
    setGenerating(true); setNote('')
    try {
      const res = await fetch('/api/generate-exercise-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises: [exerciseName.trim()] }),
      })
      const d = (await res.json())?.details?.[0]
      if (d?.how) {
        onChange({ how: d.how, breathing: d.breathing || value.breathing, core: d.core || value.core, tip: d.tip || value.tip })
        setNote('Generated — edit anything you like.')
      } else setNote('Generation failed — try again.')
    } catch { setNote('Generation failed — try again.') }
    setGenerating(false)
  }

  const cf = value.custom_fields
  const addCf = () => onChange({ custom_fields: [...cf, { label: '', text: '' }] })
  const rmCf  = (i: number) => onChange({ custom_fields: cf.filter((_, idx) => idx !== i) })
  const upCf  = (i: number, patch: Partial<{ label: string; text: string }>) =>
    onChange({ custom_fields: cf.map((c, idx) => idx === i ? { ...c, ...patch } : c) })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>Coaching Instructions</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={autofill} disabled={autofilling || generating}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-mid)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {autofilling ? '…' : '✨ Autofill (free)'}
          </button>
          <button type="button" onClick={generate} disabled={autofilling || generating}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {generating ? 'Generating…' : '🧠 Generate with AI'}
          </button>
        </div>
      </div>
      {note && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{note}</p>}

      {fieldOrder.map(k => (
        <div key={k} style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{STANDARD_LABELS[k]}</p>
          <textarea
            value={value[k] as string}
            onChange={e => onChange({ [k]: e.target.value } as Partial<Cues>)}
            placeholder={`${STANDARD_LABELS[k]}…`}
            rows={k === 'how' ? 3 : 2}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
          />
        </div>
      ))}

      {!showManual && cf.length === 0 ? (
        <button type="button" onClick={() => { setShowManual(true); addCf() }}
          style={{ padding: '4px 0', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add your own field (e.g. Heart Rate)
        </button>
      ) : (
        <div style={{ marginTop: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Your Custom Fields</p>
          {cf.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <input value={c.label} onChange={e => upCf(i, { label: e.target.value })} placeholder="Label" style={{ ...inputStyle, flex: '0 0 36%' }} />
              <textarea value={c.text} onChange={e => upCf(i, { text: e.target.value })} placeholder="What to tell the athlete…" rows={2} style={{ ...inputStyle, flex: 1, resize: 'vertical', lineHeight: 1.5 }} />
              <button type="button" onClick={() => rmCf(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '6px 2px' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addCf}
            style={{ padding: '4px 0', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add another field
          </button>
        </div>
      )}
    </div>
  )
}
