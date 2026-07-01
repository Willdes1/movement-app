'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Chunk 3 — one-click bulk instruction curation across ALL coach programs.
// Self-hiding: renders nothing while loading, and vanishes the moment every
// exercise is covered (no dead button left behind).

export default function InstructionCuratePanel() {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [curating, setCurating] = useState(false)
  const [done, setDone] = useState(0)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/curate-all-instructions', { headers: await authHeaders() })
        if (!res.ok) { setRemaining(0); return }
        const data = await res.json()
        setRemaining(data.remaining ?? 0); setTotal(data.total ?? 0)
      } catch { setRemaining(0) }
    })()
  }, [])

  async function curateAll() {
    setCurating(true)
    let guard = 0
    while (guard++ < 60) {
      const res = await fetch('/api/admin/curate-all-instructions', { method: 'POST', headers: await authHeaders() })
      if (!res.ok) break
      const data = await res.json()
      setDone(d => d + (data.generated ?? 0))
      setRemaining(data.remaining ?? 0)
      if (!data.remaining || !data.generated) break
    }
    setCurating(false)
  }

  if (remaining === null) return null   // loading — nothing yet
  if (remaining === 0) return null      // mission complete — vanish

  const pct = total ? Math.round(((total - remaining) / total) * 100) : 0

  return (
    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🧠</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#e5e7eb' }}>Instruction Curation</span>
      </div>
      <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, marginBottom: 12 }}>
        <strong style={{ color: '#e5e7eb' }}>{remaining}</strong> exercise{remaining === 1 ? '' : 's'} across your programs still need coaching instructions.
        One click fills them all — free from the library where possible, AI for the rest.
      </p>
      <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
      </div>
      <button
        onClick={curateAll}
        disabled={curating}
        style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 800, fontSize: 14, cursor: curating ? 'default' : 'pointer', fontFamily: 'inherit', opacity: curating ? 0.85 : 1 }}
      >
        {curating ? `Curating… ${done} done · ${remaining} left` : '✨ Curate All Programs'}
      </button>
    </div>
  )
}
