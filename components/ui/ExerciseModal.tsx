'use client'
import { useEffect } from 'react'
import { useModal } from '@/contexts/ModalContext'
import { MOVEMENTS } from '@/lib/data'
import type { Exercise } from '@/lib/types'

export default function ExerciseModal() {
  const { modal, openExercise, closeModal } = useModal()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal])

  if (!modal.key) return null

  const ex: Exercise | undefined = MOVEMENTS[modal.key]
  if (!ex) return null

  // If it's a group, show the group intro + sub-exercises
  if (ex.group) {
    return <GroupModal ex={ex} openExercise={openExercise} closeModal={closeModal} fromGroup={modal.key} />
  }

  return <SingleModal ex={ex} closeModal={closeModal} fromGroup={modal.fromGroup} openBack={openExercise} />
}

function GroupModal({
  ex,
  openExercise,
  closeModal,
  fromGroup,
}: {
  ex: Exercise
  openExercise: (key: string, fromGroup?: string) => void
  closeModal: () => void
  fromGroup: string
}) {
  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-box animate-modalPop" onClick={e => e.stopPropagation()}>
        <button onClick={closeModal} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 22 }}>✕</button>
        <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{ex.tag}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{ex.name}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>{ex.meta}</p>
        {ex.intro && (
          <div className="cue-box" style={{ marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>{ex.intro}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ex.group!.map(key => {
            const sub = MOVEMENTS[key]
            if (!sub) return null
            return (
              <button
                key={key}
                onClick={() => openExercise(key, fromGroup)}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 15 }}>{sub.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sub.meta}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SingleModal({
  ex,
  closeModal,
  fromGroup,
  openBack,
}: {
  ex: Exercise
  closeModal: () => void
  fromGroup: string | null
  openBack: (key: string, fromGroup?: string) => void
}) {
  const tabs = ['How', 'Cue', 'Core', 'Breathing']
  const content: Record<string, string | undefined> = {
    How: ex.how,
    Cue: ex.cue,
    Core: ex.core,
    Breathing: ex.breathing,
  }

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-box animate-modalPop" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            {fromGroup && (
              <button
                onClick={() => openBack(fromGroup)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', marginBottom: 6, padding: 0 }}
              >
                ← Back
              </button>
            )}
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{ex.tag}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{ex.name}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 2 }}>{ex.meta}</p>
          </div>
          <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 22, padding: '0 0 0 12px' }}>✕</button>
        </div>

        {/* SVG animation */}
        {ex.svg && (
          <div
            style={{ width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'var(--surface2)' }}
            dangerouslySetInnerHTML={{ __html: ex.svg }}
          />
        )}

        {/* Info tabs */}
        <InfoTabs tabs={tabs} content={content} />
      </div>
    </div>
  )
}

function InfoTabs({ tabs, content }: { tabs: string[]; content: Record<string, string | undefined> }) {
  const available = tabs.filter(t => content[t])
  if (available.length === 0) return null

  // Simple tab state using details/summary trick — for simplicity use accordion
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {available.map(tab => (
        <details key={tab} style={{ background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{
            padding: '12px 14px',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            listStyle: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {tab}
            <span style={{ fontSize: 18, color: 'var(--text-dim)' }}>›</span>
          </summary>
          <div style={{ padding: '0 14px 14px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-mid)' }}>
            {content[tab]}
          </div>
        </details>
      ))}
    </div>
  )
}
