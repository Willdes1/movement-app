'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function ImpersonationBanner() {
  const { impersonating, impersonatedUserName, stopImpersonation } = useAuth()
  const router = useRouter()

  if (!impersonating) return null

  function handleExit() {
    stopImpersonation()
    router.push('/admin')
  }

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 999,
      background: 'linear-gradient(90deg, #7c1d1d 0%, #991b1b 100%)',
      borderBottom: '1px solid rgba(239,68,68,0.4)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>👁</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.02em' }}>
          Admin View
        </span>
        <span style={{ fontSize: 12, color: '#f87171' }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fee2e2' }}>
          {impersonatedUserName}
        </span>
        <span style={{ fontSize: 11, color: '#fca5a5', fontWeight: 500 }}>
          (read/write as this user)
        </span>
      </div>
      <button
        onClick={handleExit}
        style={{
          padding: '4px 12px',
          borderRadius: 6,
          border: '1px solid rgba(239,68,68,0.5)',
          background: 'rgba(239,68,68,0.15)',
          color: '#fca5a5',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        Exit
      </button>
    </div>
  )
}
