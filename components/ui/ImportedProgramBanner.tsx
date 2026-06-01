'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ActiveProgram {
  id: string
  name: string
  weeks_total: number
}

export default function ImportedProgramBanner() {
  const { user } = useAuth()
  const [program, setProgram] = useState<ActiveProgram | null>(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('active_imported_program_id, imported_program_current_week')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.active_imported_program_id) return
        setCurrentWeek(data.imported_program_current_week ?? 1)
        supabase
          .from('user_imported_programs')
          .select('id, name, weeks_total')
          .eq('id', data.active_imported_program_id)
          .single()
          .then(({ data: prog }) => { if (prog) setProgram(prog) })
      })
  }, [user])

  async function handleLeave(saveProgress: boolean) {
    if (!user) return
    setLeaving(true)
    if (!saveProgress) {
      await supabase
        .from('profiles')
        .update({ active_imported_program_id: null, imported_program_current_week: 1 })
        .eq('id', user.id)
      if (program) {
        await supabase
          .from('user_imported_programs')
          .update({ status: 'paused' })
          .eq('id', program.id)
      }
    } else {
      await supabase
        .from('profiles')
        .update({ active_imported_program_id: null })
        .eq('id', user.id)
      if (program) {
        await supabase
          .from('user_imported_programs')
          .update({ status: 'paused' })
          .eq('id', program.id)
      }
    }
    setProgram(null)
    setShowModal(false)
    setLeaving(false)
  }

  if (!program) return null

  const progress = Math.round((currentWeek / program.weeks_total) * 100)

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px',
        background: 'rgba(59,130,246,0.08)',
        borderBottom: '1px solid rgba(59,130,246,0.2)',
        fontSize: 11, fontWeight: 700,
        color: 'var(--accent)',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        <span style={{ flexShrink: 0 }}>📄 Imported Program</span>
        <span style={{ color: 'var(--text-dim)', fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
          {program.name} · Week {currentWeek} of {program.weeks_total}
        </span>
        <div style={{ flex: 1, height: 3, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', minWidth: 40 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            flexShrink: 0, background: 'none',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 6, color: 'var(--accent)',
            fontSize: 10, fontWeight: 800,
            padding: '3px 8px', cursor: 'pointer',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}
        >
          Leave Plan
        </button>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 10001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20, padding: '28px 24px',
            maxWidth: 400, width: '100%',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>📄</div>
            <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8, textAlign: 'center' }}>
              Leave {program.name}?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>
              You're on <strong style={{ color: 'var(--text)' }}>Week {currentWeek} of {program.weeks_total}</strong>. Leaving returns you to your regular workout calendar.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleLeave(true)}
                disabled={leaving}
                style={{
                  padding: 14, borderRadius: 12,
                  border: '1px solid rgba(59,130,246,0.3)',
                  background: 'rgba(59,130,246,0.08)',
                  color: 'var(--accent)',
                  fontWeight: 800, fontSize: 14,
                  cursor: leaving ? 'not-allowed' : 'pointer',
                  textAlign: 'left', lineHeight: 1.4,
                }}
              >
                💾 Save progress & leave
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginTop: 2 }}>
                  Your week is saved — come back and continue any time
                </div>
              </button>

              <button
                onClick={() => handleLeave(false)}
                disabled={leaving}
                style={{
                  padding: 14, borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.06)',
                  color: '#ef4444',
                  fontWeight: 800, fontSize: 14,
                  cursor: leaving ? 'not-allowed' : 'pointer',
                  textAlign: 'left', lineHeight: 1.4,
                }}
              >
                ✕ Leave without saving
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginTop: 2 }}>
                  Exit and return to your original workout plan
                </div>
              </button>

              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: 12, borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-dim)',
                  fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel — keep going
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
