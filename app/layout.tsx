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
import CoachAssignmentPrompt from '@/components/CoachAssignmentPrompt'
import JoinLinkRedeemer from '@/components/JoinLinkRedeemer'
import AppMain from '@/components/AppMain'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import ProductTracker from '@/components/ProductTracker'

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
  metadataBase: new URL('https://atlasprime.app'),
  title: {
    default: 'Atlas Prime | AI Performance Training for Athletes and Coaches',
    template: '%s | Atlas Prime',
  },
  description:
    'Atlas Prime builds a personalized AI workout plan around your sport, history, and body, and gives coaches a full portal to program for and manage their athletes. Start free.',
  applicationName: 'Atlas Prime',
  keywords: [
    'AI workout plan',
    'personalized training program',
    'online coaching platform',
    'strength program generator',
    'coach client app',
    'AI personal trainer',
    'athlete training app',
    'sports performance training',
  ],
  alternates: { canonical: '/' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Atlas Prime',
  },
  openGraph: {
    type: 'website',
    siteName: 'Atlas Prime',
    url: 'https://atlasprime.app',
    title: 'Atlas Prime | AI Performance Training for Athletes and Coaches',
    description:
      'Your own AI training program, rebuilt around you every week. Train solo, or coach your whole roster from one place.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atlas Prime | AI Performance Training',
    description:
      'Your own AI training program, rebuilt around you every week. Train solo, or coach your whole roster from one place.',
  },
  robots: { index: true, follow: true },
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
              <AppMain>
                <ImpersonationBanner />
                <CoachAssignmentPrompt />
                <RecoveryBanner />
                <ImportedProgramBanner />
                <GenerationBanner />
                {children}
              </AppMain>
              <div className="mobile-nav-wrapper">
                <BottomNav />
              </div>
              <ReportBugButton />
              <OnboardingModal />
              <CoachWinBackModal />
              <JoinLinkRedeemer />
              <ServiceWorkerRegistrar />
              <ProductTracker />
            </PlanGenerationProvider>
          </ThemeProvider>
          </CoachedProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
