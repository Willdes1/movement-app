'use client'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

export interface PlaybookExercise {
  name: string
  meta: string
  how?: string
  cue?: string
  tip?: string
}

export interface PlaybookBlock {
  type: 'morning' | 'warmup' | 'workout' | 'abs' | 'cooldown' | 'evening' | 'rest'
  title: string
  meta: string
  exercises?: PlaybookExercise[]
}

export interface PlaybookPhaseData {
  label: string
  title: string
  sub: string
  blocks: PlaybookBlock[]
}

interface Props {
  recoveryId: string
  title: string
  description: string
  phases: PlaybookPhaseData[]
}

const BLOCK_COLORS: Record<string, string> = {
  morning: 'var(--yellow)',
  warmup: 'var(--orange)',
  workout: 'var(--accent)',
  abs: 'var(--green)',
  cooldown: 'var(--accent)',
  evening: 'var(--yellow)',
  rest: 'var(--text-dim)',
}

const BLOCK_ICONS: Record<string, string> = {
  morning: '☀️',
  warmup: '🔥',
  workout: '💪',
  abs: '⚡',
  cooldown: '🧊',
  evening: '🌙',
  rest: '😴',
}

function ExerciseRow({ ex }: { ex: PlaybookExercise }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!(ex.how || ex.cue || ex.tip)

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{ex.meta}</div>
        </div>
        {hasDetail && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'var(--surface3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              color: 'var(--accent)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {expanded ? 'Hide' : 'How'}
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {ex.how && (
            <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: ex.cue || ex.tip ? 8 : 0, lineHeight: 1.55 }}>{ex.how}</p>
          )}
          {ex.cue && (
            <p style={{ fontSize: 12, color: 'var(--accent)', fontStyle: 'italic', marginBottom: ex.tip ? 6 : 0 }}>"{ex.cue}"</p>
          )}
          {ex.tip && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>💡 {ex.tip}</p>
          )}
        </div>
      )}
    </div>
  )
}

function BlockAccordion({ block, defaultOpen = false }: { block: PlaybookBlock; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const color = BLOCK_COLORS[block.type] ?? 'var(--text-dim)'
  const icon = BLOCK_ICONS[block.type] ?? '•'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{block.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}>{block.meta}</div>
        </div>
        <svg
          width="16" height="16" fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && block.exercises && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {block.exercises.map((ex, i) => (
            <ExerciseRow key={i} ex={ex} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RecoveryPlaybook({ recoveryId, title, description, phases }: Props) {
  const [phase, setPhase] = useState(1)
  const { setRecovery } = useTheme()
  const totalPhases = phases.length

  useEffect(() => {
    setRecovery(recoveryId, phase, { totalPhases })
  }, [phase, setRecovery, recoveryId, totalPhases])

  const currentPhase = phases[phase - 1]
  const gridCols = totalPhases <= 4 ? totalPhases : 3

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Recovery Protocol
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>{title}</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>{description}</p>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 8 }}>
          {phases.map((p, i) => {
            const phaseNum = i + 1
            const active = phase === phaseNum
            return (
              <button
                key={phaseNum}
                onClick={() => setPhase(phaseNum)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-bg)' : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 900, color: active ? 'var(--accent)' : 'var(--text-dim)' }}>{p.label}</div>
                <div style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-dim)', marginTop: 2, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{p.title}</div>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
          <span style={{ fontWeight: 800, color: 'var(--accent)' }}>Phase {phase}: </span>
          <span style={{ color: 'var(--text-mid)', fontSize: 13 }}>{currentPhase.title} — {currentPhase.sub}</span>
        </div>

        <div style={{ marginTop: 10, height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${(phase / totalPhases) * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.04em', marginTop: 5 }}>
          PHASE {phase} OF {totalPhases} — {Math.round((phase / totalPhases) * 100)}% TOWARD RETURN TO SPORT
        </div>
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        {currentPhase.blocks.map((block, i) => (
          <BlockAccordion key={`${phase}-${i}`} block={block} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  )
}
