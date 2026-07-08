'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/track'

// Fires a `page_view` product event on every route change. Mounted once in the
// root layout. This is the backbone of click-through / funnel analysis — every
// screen a customer navigates to is recorded. Explicit key actions (button
// clicks) can additionally call trackEvent() directly.
export default function ProductTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname) trackEvent('page_view')
  }, [pathname])
  return null
}
