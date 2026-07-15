'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LANDING_LIVE } from '@/lib/flags'
import LandingPage from '@/components/landing/LandingPage'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) { router.replace('/today'); return }         // signed in → straight to the app
    if (!LANDING_LIVE) router.replace('/auth')              // flag off → revert to old sign-in-first behavior
  }, [user, loading, router])

  // Logged-out visitors see the marketing landing page (unless it's been reverted).
  if (!loading && !user && LANDING_LIVE) return <LandingPage />
  return null
}
