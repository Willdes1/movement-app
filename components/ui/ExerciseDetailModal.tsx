'use client'
import { useEffect, useState, type ReactNode } from 'react'
import LoopPreview from '@/components/ui/LoopPreview'
import { useTTS } from '@/hooks/useTTS'
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
  const { speak, stop, speaking, loading: ttsLoading, gender, toggleGender } = useTTS()
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

  const sections = [
    { label: 'HOW TO PERFORM', text: data.how, color: 'var(--text)' },
    { label: 'BREATHING', text: data.breathing, color: 'var(--text-mid)' },
    { label: 'CORE ENGAGEMENT', text: data.core, color: 'var(--text-mid)' },
    { label: 'COMMON MISTAKES', text: data.tip, color: 'var(--accent)' },
  ].filter(s => !!s.text)

  function readAloud() {
    if (speaking || ttsLoading) { stop(); return }
    const preUrl = gender === 'male' ? data.tts_url_male : data.tts_url_female
    const parts = [data.name_display]
    if (data.how) parts.push(data.how)
    if (data.breathing) parts.push('Breathing: ' + data.breathing)
    if (data.core) parts.push('Core engagement: ' + data.core)
    if (data.tip) parts.push('Common mistake: ' + data.tip)
    speak(parts.join('. '), { preGeneratedUrl: preUrl ?? undefined, nameNormalized: preUrl ? undefined : data.name_normalized })
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
                <button onClick={readAloud} title={speaking ? 'Stop' : ttsLoading ? 'Loading…' : 'Read aloud'} style={{ background: speaking ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${speaking ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', fontSize: 16, cursor: ttsLoading ? 'wait' : 'pointer', lineHeight: 1, animation: speaking ? 'tts-pulse 1.2s ease-in-out infinite' : 'none', opacity: ttsLoading ? 0.6 : 1 }}>
                  {ttsLoading ? '⏳' : speaking ? '🔊' : '🔈'}
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
              {sections.map(({ label, text, color }) => (
                <div key={label} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ fontSize: 13, color, lineHeight: 1.65 }}>{text}</p>
                </div>
              ))}
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
