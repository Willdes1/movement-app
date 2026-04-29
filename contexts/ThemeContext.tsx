'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getActiveRecovery, setActiveRecovery, clearActiveRecovery, type ActiveRecovery } from '@/lib/storage'

type ThemeContextType = {
  activeRecovery: ActiveRecovery | null
  setRecovery: (playbook: string, phase: number, extra?: Partial<Pick<ActiveRecovery, 'planId' | 'injury' | 'totalPhases'>>) => void
  clearRecovery: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  activeRecovery: null,
  setRecovery: () => {},
  clearRecovery: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeRecovery, setActiveRecoveryState] = useState<ActiveRecovery | null>(null)

  useEffect(() => {
    const r = getActiveRecovery()
    setActiveRecoveryState(r)
  }, [])

  useEffect(() => {
    const html = document.documentElement
    if (activeRecovery) {
      html.setAttribute('data-recovery', String(activeRecovery.phase))
    } else {
      html.removeAttribute('data-recovery')
    }
  }, [activeRecovery])

  const setRecovery = useCallback((playbook: string, phase: number, extra?: Partial<Pick<ActiveRecovery, 'planId' | 'injury' | 'totalPhases'>>) => {
    const r = { playbook, phase, ...extra }
    setActiveRecovery(r)
    setActiveRecoveryState(r)
  }, [])

  const clearRecovery = useCallback(() => {
    clearActiveRecovery()
    setActiveRecoveryState(null)
  }, [])

  return (
    <ThemeContext.Provider value={{ activeRecovery, setRecovery, clearRecovery }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
