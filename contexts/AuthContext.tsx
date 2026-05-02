'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  role: 'admin' | 'beta' | 'free' | 'ff'
  signOut: () => Promise<void>
  effectiveUserId: string | null
  impersonating: boolean
  impersonatedUserName: string | null
  startImpersonation: (userId: string, name: string) => void
  stopImpersonation: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  role: 'free',
  signOut: async () => {},
  effectiveUserId: null,
  impersonating: false,
  impersonatedUserName: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
})

const IMPERSONATION_KEY = 'movement_impersonation'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<'admin' | 'beta' | 'free' | 'ff'>('free')
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null)
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null)

  async function fetchUserStatus(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin, role')
      .eq('id', userId)
      .single()
    const admin = data?.is_admin === true
    setIsAdmin(admin)
    setRole(data?.role ?? (admin ? 'admin' : 'free'))
  }

  useEffect(() => {
    // Restore impersonation from sessionStorage (clears on tab close)
    try {
      const saved = sessionStorage.getItem(IMPERSONATION_KEY)
      if (saved) {
        const { userId, name } = JSON.parse(saved)
        setImpersonatedUserId(userId)
        setImpersonatedUserName(name)
      }
    } catch {}

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await fetchUserStatus(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserStatus(session.user.id)
      } else {
        setIsAdmin(false)
        setRole('free')
        stopImpersonation()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function startImpersonation(userId: string, name: string) {
    setImpersonatedUserId(userId)
    setImpersonatedUserName(name)
    try { sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ userId, name })) } catch {}
  }

  function stopImpersonation() {
    setImpersonatedUserId(null)
    setImpersonatedUserName(null)
    try { sessionStorage.removeItem(IMPERSONATION_KEY) } catch {}
  }

  async function signOut() {
    stopImpersonation()
    await supabase.auth.signOut()
  }

  const effectiveUserId = impersonatedUserId ?? user?.id ?? null
  const impersonating = !!impersonatedUserId

  return (
    <AuthContext.Provider value={{
      user, session, loading, isAdmin, role, signOut,
      effectiveUserId, impersonating, impersonatedUserName,
      startImpersonation, stopImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
