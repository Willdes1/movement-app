'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function formatTimeLeft(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now()
  if (ms <= 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ImpersonationBanner() {
  const { impersonating, impersonatedUserName, impersonationExpiresAt, stopImpersonation } = useAuth()
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!impersonationExpiresAt) return
    setTimeLeft(formatTimeLeft(impersonationExpiresAt))
    const iv = setInterval(() => setTimeLeft(formatTimeLeft(impersonationExpiresAt)), 1_000)
    return () => clearInterval(iv)
  }, [impersonationExpiresAt])

  if (!impersonating) return null

  async function handleExit() {
    await stopImpersonation('admin_manual')
    router.push('/admin')
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 999,
      background: 'linear-gradient(90deg, #7c1d1d 0%, #991b1b 50%, #92400e 100%)',
      borderBottom: '2px solid rgba(239,68,68,0.5)',
      padding: '9px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 12 }}>🔴</span>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#fca5a5', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
          ZOOMED IN AS
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {impersonatedUserName}
        </span>
        {timeLeft && (
          <>
            <span style={{ fontSize: 11, color: 'rgba(252,165,165,0.5)', flexShrink: 0 }}>—</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fcd34d', fontFamily: 'monospace', flexShrink: 0 }}>
              {timeLeft}
            </span>
          </>
        )}
      </div>
      <button
        onClick={handleExit}
        style={{
          padding: '5px 14px', borderRadius: 6,
          border: '1px solid rgba(239,68,68,0.6)',
          background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
          fontSize: 11, fontWeight: 800, cursor: 'pointer',
          letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
        }}
      >
        Zoom Out
      </button>
    </div>
  )
}
