'use client'
import { usePathname } from 'next/navigation'

// The athlete app's <main> reserves space for the athlete sidebar (desktop)
// and header/bottom nav (mobile). Coach portal, admin, auth, legal, and join
// pages have their own layouts — applying .app-main there double-offsets them
// (e.g. coach pages got 230px athlete margin + 230px coach margin).
const BARE_ROUTES = ['/coach', '/admin', '/auth', '/legal', '/join']

export default function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = BARE_ROUTES.some(p => pathname.startsWith(p))
  return <main className={bare ? undefined : 'app-main'}>{children}</main>
}
