'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import LoopPreview from '@/components/ui/LoopPreview'
import { useTTS } from '@/hooks/useTTS'
import { useTTSProgress } from '@/contexts/TTSContext'
import { buildSpeechText, speechSections } from '@/lib/speech-text'
import { supabase } from '@/lib/supabase'

// Reusable expanded-exercise popup, shared by the calendar day view, the coached
// workout, and anywhere set tracking needs to live. Common Mistakes maps to the
// existing `tip` field (which the generator fills with the most common mistake).

export type ExerciseDetailData = {
  name_display: string
  name_normalized: string
  how?: string | null
  breathing?: string | null
  core?: string | null
  tip?: string | null
  video_url?: string | null
  video_source?: string | null
  youtube_start_sec?: number | null
  youtube_end_sec?: number | null
  loop_start_sec?: number | null
  loop_end_sec?: number | null
  tts_url_male?: string | null
  tts_url_female?: string | null
}

export type LastLogSummary = {
  sets?: number | null
  reps?: number | null
  weight?: number | null
  weight_unit?: string | null
  logged_at: string
}

type SetLogRow = { id: string; performed_at: string; set_number: number; reps: number | null; weight: number | null; weight_unit: string | null; side: string | null; notes: string | null; program_name: string | null }

// Cluster a user's set rows into sessions (grouped by the hour they were logged).
function groupSessions(rows: SetLogRow[]) {
  const groups: Record<string, SetLogRow[]> = {}
  for (const r of rows) {
    const key = new Date(r.performed_at).toISOString().slice(0, 13)
    ;(groups[key] ??= []).push(r)
  }
  return Object.entries(groups)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, sets]) => ({
      key,
      when: new Date(sets[0].performed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      program: sets[0].program_name,
      sets: [...sets].sort((a, b) => a.set_number - b.set_number),
    }))
}

function SetHistoryView({ history }: { history: SetLogRow[] }) {
  const sessions = groupSessions(history)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sessions.map(s => (
        <div key={s.key} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{s.when}</span>
            {s.program && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{s.program}</span>}
          </div>
          {s.sets.map(set => (
            <div key={set.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)', width: 50, flexShrink: 0 }}>Set {set.set_number}{set.side ? ` ${set.side[0].toUpperCase()}` : ''}</span>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                {set.reps == null && set.weight == null
                  ? '—'
                  : `${set.reps != null ? `${set.reps} reps` : ''}${set.reps != null && set.weight != null ? ' × ' : ''}${set.weight != null ? `${set.weight} ${set.weight_unit ?? 'lbs'}` : ''}`}
              </span>
              {set.notes && <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 'auto', fontStyle: 'italic' }}>{set.notes}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function ExerciseDetailModal({
  data, onClose, lastLog, generating, footer, userId, historyRefresh,
}: {
  data: ExerciseDetailData
  onClose: () => void
  lastLog?: LastLogSummary | null
  generating?: boolean
  footer?: ReactNode
  userId?: string
  historyRefresh?: number
}) {
  const { toggle: ttsToggle, stop, stopIf, speaking, loading: ttsLoading, activeKey, gender, toggleGender } = useTTS()
  const { progress } = useTTSProgress()
  // Audio lives above this component now, so closing the modal has to stop it
  // explicitly. Scoped to our own key so it never kills playback that another
  // surface started.
  const fullKey = `exercise:${data.name_normalized}`
  const [tab, setTab] = useState<'info' | 'history'>('info')
  const [history, setHistory] = useState<SetLogRow[]>([])

  useEffect(() => {
    if (!userId) return
    supabase.from('exercise_set_logs')
      .select('id, performed_at, set_number, reps, weight, weight_unit, side, notes, program_name')
      .eq('user_id', userId)
      .eq('exercise_normalized', data.name_normalized)
      .order('performed_at', { ascending: false })
      .limit(80)
      .then(({ data: rows }) => setHistory((rows as SetLogRow[]) ?? []))
  }, [userId, data.name_normalized, historyRefresh])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { stop(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, stop])

  const close = () => { stop(); onClose() }

  // Stop our own audio if the modal disappears without close() running.
  useEffect(() => () => stopIf(fullKey), [fullKey, stopIf])

  const SECTION_COLOR: Record<string, string> = {
    how: 'var(--text)', breathing: 'var(--text-mid)', core: 'var(--text-mid)', tip: 'var(--accent)',
  }
  const sections = speechSections(data)
  const isReadingFull = activeKey === fullKey && (speaking || ttsLoading)
  const isLoadingFull = activeKey === fullKey && ttsLoading

  // Where each section sits in the full narration, as a fraction of the whole.
  // Reading everything plays ONE file (the pre-generated one when it exists), so
  // nothing tells us which section is being spoken. TTS pacing is near constant,
  // so character position is a good proxy and it costs nothing.
  const sectionBounds = useMemo(() => {
    const total = buildSpeechText(data).length || 1
    let cursor = data.name_display.length + 2
    return speechSections(data).map(s => {
      const start = cursor / total
      cursor += s.spoken.length + 2
      return { id: s.id, start, end: Math.min(cursor / total, 1) }
    })
  }, [data])

  const liveSectionId = (() => {
    if (activeKey?.startsWith(`${fullKey}:`)) return activeKey.slice(fullKey.length + 1)
    if (activeKey !== fullKey || !speaking) return null
    return sectionBounds.find(b => progress >= b.start && progress < b.end)?.id ?? null
  })()

  function readAloud() {
    const preUrl = gender === 'male' ? data.tts_url_male : data.tts_url_female
    void ttsToggle(fullKey, buildSpeechText(data), {
      label: data.name_display,
      preGeneratedUrl: preUrl ?? undefined,
      // No cached file means this call generates one, and passing the slug also
      // saves it onto the row, so the next athlete hears it for free.
      nameNormalized: preUrl ? undefined : data.name_normalized,
    })
  }

  function readSection(id: string, label: string, spoken: string) {
    // Deliberately no nameNormalized: this is a fragment, and saving it would
    // overwrite the exercise's full narration with a single section.
    void ttsToggle(`${fullKey}:${id}`, spoken, { label: `${data.name_display}, ${label.toLowerCase()}` })
  }

  return (
    <>
      <style>{`@keyframes tts-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, border: '1px solid var(--border)', borderBottom: 'none', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <p style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{data.name_display}</p>
                {generating && <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>Generating coaching details…</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={toggleGender} title={`Voice: ${gender}. Tap to switch.`} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  {gender === 'male' ? '♂' : '♀'}
                </button>
                <button onClick={readAloud} title={isReadingFull ? 'Stop' : 'Read aloud'} style={{ background: isReadingFull ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${isReadingFull ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', fontSize: 16, cursor: isLoadingFull ? 'wait' : 'pointer', lineHeight: 1, animation: isReadingFull && !isLoadingFull ? 'tts-pulse 1.2s ease-in-out infinite' : 'none', opacity: isLoadingFull ? 0.6 : 1 }}>
                  {isLoadingFull ? '⏳' : isReadingFull ? '🔊' : '🔈'}
                </button>
                <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never, padding: '0 24px 40px', flexGrow: 1 }}>
            {/* History tab appears only once the user has logged sets */}
            {history.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {(['info', 'history'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: tab === t ? 'var(--accent)' : 'var(--surface2)', color: tab === t ? '#fff' : 'var(--text-mid)', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t === 'info' ? 'Instructions' : `History (${groupSessions(history).length})`}
                  </button>
                ))}
              </div>
            )}

            {tab === 'history' ? (
              <SetHistoryView history={history} />
            ) : (
            <>
            <LoopPreview url={data.video_url ?? null} source={data.video_source ?? null} name={data.name_display} loopStart={data.loop_start_sec} loopEnd={data.loop_end_sec} clipStart={data.youtube_start_sec} clipEnd={data.youtube_end_sec} />

            {lastLog !== undefined && (
              <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase' }}>Last Session</p>
                {lastLog ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {lastLog.weight != null && <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{lastLog.weight} {lastLog.weight_unit ?? 'lbs'}</span>}
                    {(lastLog.sets != null || lastLog.reps != null) && (
                      <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>
                        {[lastLog.sets != null && `${lastLog.sets} sets`, lastLog.reps != null && `${lastLog.reps} reps`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{new Date(lastLog.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No sessions logged yet</p>
                )}
              </div>
            )}

            {footer}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: footer ? 14 : 0 }}>
              {sections.map(({ id, label, body, spoken }) => {
                const live = liveSectionId === id
                const sectionPlaying = activeKey === `${fullKey}:${id}` && (speaking || ttsLoading)
                return (
                  <div key={id} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: `1px solid ${live ? 'var(--accent)' : 'var(--border)'}`, transition: 'border-color 0.25s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: live ? 'var(--accent)' : 'var(--text-dim)', textTransform: 'uppercase', flex: 1 }}>{label}</p>
                      <button
                        onClick={() => readSection(id, label, spoken)}
                        title={sectionPlaying ? 'Stop' : `Read ${label.toLowerCase()}`}
                        aria-label={sectionPlaying ? 'Stop' : `Read ${label.toLowerCase()}`}
                        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: sectionPlaying ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0 }}
                      >
                        {sectionPlaying ? '🔊' : '🔈'}
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: SECTION_COLOR[id], lineHeight: 1.65 }}>{body}</p>
                  </div>
                )
              })}
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
