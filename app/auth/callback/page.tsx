'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      router.replace('/auth')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.user) {
        router.replace('/auth?error=oauth')
        return
      }

      // Coach signup via /coaches → assign role and land in the Coach Portal.
      try {
        if (sessionStorage.getItem('pendingCoach')) {
          await supabase.from('profiles').upsert({ id: data.user.id, role: 'coach' })
          sessionStorage.removeItem('pendingCoach')
          router.replace('/coach/dashboard')
          return
        }
      } catch { /* silent — session storage unavailable */ }

      // Apply promo code stored before the OAuth redirect (signup flow)
      try {
        const pending = sessionStorage.getItem('pendingPromo')
        if (pending) {
          const promo = JSON.parse(pending) as { id: string; role: string; uses: number }
          await supabase.from('profiles').upsert({ id: data.user.id, role: promo.role })
          await supabase.from('promo_codes').update({ uses: promo.uses + 1 }).eq('id', promo.id)
          sessionStorage.removeItem('pendingPromo')
        }
      } catch { /* silent — promo already applied or session storage unavailable */ }

      router.replace('/today')
    }).catch(() => router.replace('/auth?error=oauth'))
  }, [router])

  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
      Signing in…
    </div>
  )
}
