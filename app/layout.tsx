import type { Metadata, Viewport } from 'next'
import { DM_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/ui/BottomNav'
import Sidebar from '@/components/ui/Sidebar'
import MobileMenu from '@/components/ui/MobileMenu'
import RecoveryBanner from '@/components/ui/RecoveryBanner'
import ImportedProgramBanner from '@/components/ui/ImportedProgramBanner'
import ImpersonationBanner from '@/components/ui/ImpersonationBanner'
import { AuthProvider } from '@/contexts/AuthContext'
import { CoachedProvider } from '@/contexts/CoachedContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { PlanGenerationProvider } from '@/components/PlanGenerationContext'
import GenerationBanner from '@/components/GenerationBanner'
import ReportBugButton from '@/components/ReportBugButton'
import OnboardingModal from '@/components/OnboardingModal'
import CoachWinBackModal from '@/components/CoachWinBackModal'
import JoinLinkRedeemer from '@/components/JoinLinkRedeemer'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'

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
  title: 'Atlas Prime',
  description: 'AI-powered performance training for serious athletes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Atlas Prime',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0f12',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-dm-sans, DM Sans), sans-serif' }} suppressHydrationWarning>
        <AuthProvider>
          <CoachedProvider>
          <ThemeProvider>
            <PlanGenerationProvider>
              <div className="grain" />
              <Sidebar />
              <MobileMenu />
              <main className="app-main">
                <ImpersonationBanner />
                <RecoveryBanner />
                <ImportedProgramBanner />
                <GenerationBanner />
                {children}
              </main>
              <div className="mobile-nav-wrapper">
                <BottomNav />
              </div>
              <ReportBugButton />
              <OnboardingModal />
              <CoachWinBackModal />
              <JoinLinkRedeemer />
              <ServiceWorkerRegistrar />
            </PlanGenerationProvider>
          </ThemeProvider>
          </CoachedProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
