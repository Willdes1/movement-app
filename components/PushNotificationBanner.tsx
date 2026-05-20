'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

const DISMISS_KEY = (id: string) => `push_dismissed_${id}`
const SUBSCRIBED_KEY = (id: string) => `push_subscribed_${id}`

export default function PushNotificationBanner() {
  const { user, isAdmin, role } = useAuth()
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'denied' | 'error'>('idle')

  useEffect(() => {
    if (!user) return
    if (isAdmin || role === 'admin' || role === 'coach') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') return
    if (localStorage.getItem(DISMISS_KEY(user.id))) return
    if (localStorage.getItem(SUBSCRIBED_KEY(user.id))) return
    setShow(true)
  }, [user, isAdmin, role])

  async function enable() {
    if (!user) return
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        setShow(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
        ),
      })

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, subscription: sub.toJSON() }),
      })

      localStorage.setItem(SUBSCRIBED_KEY(user.id), '1')
      setStatus('success')
      setShow(false)
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    if (!user) return
    localStorage.setItem(DISMISS_KEY(user.id), '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      margin: '0 16px 16px',
      padding: '14px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--accent-border)',
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          Enable workout reminders
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Get a daily nudge so you never miss a session.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={enable}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700,
            fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
          }}
        >
          {loading ? 'Enabling…' : 'Enable'}
        </button>
        <button
          onClick={dismiss}
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
