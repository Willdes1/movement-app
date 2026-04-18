'use client'
import { useState, useEffect } from 'react'
import { getSetDone, setSetDone, getWeight, setWeight } from '@/lib/storage'

interface Props {
  phase: number
  variant: number
  movement: string
  sets: number
  showWeight?: boolean
}

export default function SetTracker({ phase, variant, movement, sets, showWeight = true }: Props) {
  const [done, setDone] = useState<boolean[]>([])
  const [weight, setWeightState] = useState('')

  useEffect(() => {
    const initial = Array.from({ length: sets }, (_, i) => getSetDone(phase, variant, movement, i))
    setDone(initial)
    setWeightState(getWeight(phase, variant, movement))
  }, [phase, variant, movement, sets])

  function toggleSet(i: number) {
    const next = !done[i]
    setSetDone(phase, variant, movement, i, next)
    setDone(prev => {
      const copy = [...prev]
      copy[i] = next
      return copy
    })
  }

  function handleWeight(val: string) {
    setWeightState(val)
    setWeight(phase, variant, movement, val)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: sets }, (_, i) => (
          <button
            key={i}
            onClick={() => toggleSet(i)}
            className={`set-circle${done[i] ? ' done' : ''}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {showWeight && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="lbs"
          value={weight}
          onChange={e => handleWeight(e.target.value)}
          className="weight-input"
        />
      )}
    </div>
  )
}
