'use client'
import { useState } from 'react'
import type { PhaseBlock, PhaseVariant } from '@/lib/types'
import { MOVEMENTS } from '@/lib/data'
import { useModal } from '@/contexts/ModalContext'
import SetTracker from './SetTracker'

interface Props {
  block: PhaseBlock
  phase: number
  defaultOpen?: boolean
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

function parseSets(meta: string): number {
  const m = meta.match(/(\d+)\s*[xX×]\s*\d+/)
  if (m) return parseInt(m[1])
  const m2 = meta.match(/(\d+)\s*sets/)
  if (m2) return parseInt(m2[1])
  return 0
}

function MovementRow({ movKey, phase, variant }: { movKey: string; phase: number; variant: number }) {
  const { openExercise } = useModal()
  const ex = MOVEMENTS[movKey]
  if (!ex) return null

  const sets = parseSets(ex.meta)
  const isGroup = !!ex.group

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{ex.meta}</div>
        </div>
        <button
          onClick={() => openExercise(movKey)}
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
          {isGroup ? 'View' : 'How'}
        </button>
      </div>
      {sets > 0 && (
        <SetTracker phase={phase} variant={variant} movement={movKey} sets={sets} />
      )}
    </div>
  )
}

function VariantSection({ variants, phase }: { variants: PhaseVariant[]; phase: number }) {
  const [active, setActive] = useState(0)
  const v = variants[active]

  return (
    <div>
      {variants.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {variants.map((vt, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${i === active ? 'var(--accent)' : 'var(--border)'}`,
                background: i === active ? 'var(--accent-bg)' : 'transparent',
                color: i === active ? 'var(--accent)' : 'var(--text-dim)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {vt.label}
            </button>
          ))}
        </div>
      )}
      {v.desc && (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>{v.desc}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {v.movements.map(key => (
          <MovementRow key={key} movKey={key} phase={phase} variant={active} />
        ))}
      </div>
    </div>
  )
}

export default function BlockAccordion({ block, phase, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const color = BLOCK_COLORS[block.type] ?? 'var(--text-dim)'
  const icon = BLOCK_ICONS[block.type] ?? '•'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
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
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {block.variants ? (
            <VariantSection variants={block.variants} phase={phase} />
          ) : block.movements ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {block.movements.map(key => (
                <MovementRow key={key} movKey={key} phase={phase} variant={0} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
