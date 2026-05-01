import type { Metadata, Viewport } from 'next'
import { DM_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/ui/BottomNav'
import Sidebar from '@/components/ui/Sidebar'
import RecoveryBanner from '@/components/ui/RecoveryBanner'
import ImpersonationBanner from '@/components/ui/ImpersonationBanner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { PlanGenerationProvider } from '@/components/PlanGenerationContext'
import GenerationBanner from '@/components/GenerationBanner'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Movement App',
  description: 'Personalized movement & recovery for athletes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Movement',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0f12',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-dm-sans, DM Sans), sans-serif' }} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            <PlanGenerationProvider>
              <div className="grain" />
              <Sidebar />
              <main className="app-main">
                <ImpersonationBanner />
                <RecoveryBanner />
                <GenerationBanner />
                {children}
              </main>
              <div className="mobile-nav-wrapper">
                <BottomNav />
              </div>
            </PlanGenerationProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
