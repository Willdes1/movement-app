'use client'
import { useState, useEffect, type CSSProperties, type ReactNode } from 'react'

// Small dismissible hint. Three dismissal levels:
//   Dismiss              → hide for now (returns next time)
//   Not for this workout → remembered per scopeKey (e.g. this exercise)
//   Don't remind me      → remembered globally for this tip id
// Persistence is localStorage; starts hidden until the client check runs (no SSR flash).

const tipBtn: CSSProperties = { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'inherit' }

export default function TrackingTip({ id, scopeKey, children }: { id: string; scopeKey?: string; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const off = !!localStorage.getItem(`tip_off_${id}`) || (scopeKey ? !!localStorage.getItem(`tip_off_${id}_${scopeKey}`) : false)
    setDismissed(off)
  }, [id, scopeKey])

  if (dismissed) return null

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', marginBottom: 10 }}>
      <p style={{ fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 8 }}>💡 {children}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button onClick={() => setDismissed(true)} style={tipBtn}>Dismiss</button>
        {scopeKey && (
          <button onClick={() => { localStorage.setItem(`tip_off_${id}_${scopeKey}`, '1'); setDismissed(true) }} style={tipBtn}>Not for this workout</button>
        )}
        <button onClick={() => { localStorage.setItem(`tip_off_${id}`, '1'); setDismissed(true) }} style={tipBtn}>Don&apos;t remind me</button>
      </div>
    </div>
  )
}
