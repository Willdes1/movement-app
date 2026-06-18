'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  openImpersonationSession,
  closeImpersonationSession,
  logImpersonationAction,
  queueSoftDelete,
} from '@/lib/impersonation-logger'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  isOwner: boolean
  hasAdminAccess: boolean
  adminTabs: string[] | null   // null = owner / all tabs; array = partner's allowed tab ids
  role: 'admin' | 'coach' | 'beta' | 'free' | 'ff'
  signOut: () => Promise<void>
  effectiveUserId: string | null
  impersonating: boolean
  impersonatedUserName: string | null
  impersonationSessionId: string | null
  impersonationExpiresAt: Date | null
  startImpersonation: (userId: string, name: string, durationMinutes: number, reason?: string) => Promise<void>
  stopImpersonation: (endedBy?: 'admin_manual' | 'auto_timeout' | 'session_end') => Promise<void>
  loggedInsert: (tableName: string, data: Record<string, unknown>, pkField?: string) => Promise<{ data: unknown; error: unknown }>
  loggedDelete: (tableName: string, rowId: string, pkField?: string) => Promise<{ data: unknown; error: unknown }>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isOwner: false,
  hasAdminAccess: false,
  adminTabs: null,
  role: 'free',
  signOut: async () => {},
  effectiveUserId: null,
  impersonating: false,
  impersonatedUserName: null,
  impersonationSessionId: null,
  impersonationExpiresAt: null,
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
  loggedInsert: async () => ({ data: null, error: null }),
  loggedDelete: async () => ({ data: null, error: null }),
})

const IMPERSONATION_KEY = 'movement_impersonation'

type StoredImpersonation = {
  userId: string
  name: string
  sessionId: string
  expiresAt: string
  reason: string | null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [hasAdminAccess, setHasAdminAccess] = useState(false)
  const [adminTabs, setAdminTabs] = useState<string[] | null>(null)
  const [role, setRole] = useState<'admin' | 'coach' | 'beta' | 'free' | 'ff'>('free')
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null)
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null)
  const [impersonationSessionId, setImpersonationSessionId] = useState<string | null>(null)
  const [impersonationExpiresAt, setImpersonationExpiresAt] = useState<Date | null>(null)

  // Refs to avoid stale closures in timers
  const impersonationSessionIdRef = useRef<string | null>(null)
  const impersonatedUserIdRef = useRef<string | null>(null)
  const userRef = useRef<User | null>(null)

  impersonationSessionIdRef.current = impersonationSessionId
  impersonatedUserIdRef.current = impersonatedUserId
  userRef.current = user

  async function fetchUserStatus(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin, is_owner, role')
      .eq('id', userId)
      .single()
    const admin = data?.is_admin === true
    const owner = admin || data?.is_owner === true
    setIsAdmin(admin)
    setIsOwner(owner)
    setRole(data?.role ?? (admin ? 'admin' : 'free'))

    if (owner) {
      // Owner sees everything — no tab restriction.
      setHasAdminAccess(true)
      setAdminTabs(null)
      return
    }

    // Partner path — access driven solely by an active admin_permissions row.
    const { data: perm } = await supabase
      .from('admin_permissions')
      .select('allowed_tabs, active')
      .eq('user_id', userId)
      .maybeSingle()
    if (perm?.active) {
      setHasAdminAccess(true)
      setAdminTabs((perm.allowed_tabs ?? []) as string[])
    } else {
      setHasAdminAccess(false)
      setAdminTabs(null)
    }
  }

  // Auto-exit timer — checks every 10 seconds
  useEffect(() => {
    if (!impersonationExpiresAt) return
    const interval = setInterval(async () => {
      if (new Date() >= impersonationExpiresAt) {
        const sid = impersonationSessionIdRef.current
        if (sid) {
          try { await closeImpersonationSession({ sessionId: sid, endedBy: 'auto_timeout' }) } catch { /* silent */ }
        }
        clearImpersonationState()
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [impersonationExpiresAt])

  function clearImpersonationState() {
    setImpersonatedUserId(null)
    setImpersonatedUserName(null)
    setImpersonationSessionId(null)
    setImpersonationExpiresAt(null)
    impersonationSessionIdRef.current = null
    impersonatedUserIdRef.current = null
    try { sessionStorage.removeItem(IMPERSONATION_KEY) } catch { /* silent */ }
  }

  useEffect(() => {
    // Restore impersonation from sessionStorage on page load
    try {
      const saved = sessionStorage.getItem(IMPERSONATION_KEY)
      if (saved) {
        const stored = JSON.parse(saved) as StoredImpersonation
        const expiresAt = new Date(stored.expiresAt)
        if (expiresAt > new Date()) {
          setImpersonatedUserId(stored.userId)
          setImpersonatedUserName(stored.name)
          setImpersonationSessionId(stored.sessionId)
          setImpersonationExpiresAt(expiresAt)
        } else {
          // Session expired while page was closed — close it out
          if (stored.sessionId) {
            closeImpersonationSession({ sessionId: stored.sessionId, endedBy: 'auto_timeout' }).catch(() => {})
          }
          sessionStorage.removeItem(IMPERSONATION_KEY)
        }
      }
    } catch { /* silent */ }

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
        setIsOwner(false)
        setHasAdminAccess(false)
        setAdminTabs(null)
        setRole('free')
        // Close any active impersonation session on sign-out
        const sid = impersonationSessionIdRef.current
        if (sid) {
          closeImpersonationSession({ sessionId: sid, endedBy: 'session_end' }).catch(() => {})
        }
        clearImpersonationState()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function startImpersonation(userId: string, name: string, durationMinutes: number, reason?: string) {
    const currentUser = userRef.current
    if (!currentUser) return
    const sessionId = await openImpersonationSession({
      adminId: currentUser.id,
      targetUserId: userId,
      durationMinutes,
      reason,
    })
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
    setImpersonatedUserId(userId)
    setImpersonatedUserName(name)
    setImpersonationSessionId(sessionId)
    setImpersonationExpiresAt(expiresAt)
    try {
      const stored: StoredImpersonation = { userId, name, sessionId, expiresAt: expiresAt.toISOString(), reason: reason ?? null }
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(stored))
    } catch { /* silent */ }
  }

  async function stopImpersonation(endedBy: 'admin_manual' | 'auto_timeout' | 'session_end' = 'admin_manual') {
    const sid = impersonationSessionIdRef.current
    if (sid) {
      try { await closeImpersonationSession({ sessionId: sid, endedBy }) } catch { /* silent */ }
    }
    clearImpersonationState()
  }

  // Logged insert — performs insert and logs it if impersonating
  async function loggedInsert(
    tableName: string,
    data: Record<string, unknown>,
    pkField = 'id'
  ): Promise<{ data: unknown; error: unknown }> {
    const result = await supabase.from(tableName).insert(data).select().single()
    const sid = impersonationSessionIdRef.current
    const targetId = impersonatedUserIdRef.current
    const currentUser = userRef.current
    if (sid && targetId && currentUser && result.data) {
      const rowId = String((result.data as Record<string, unknown>)[pkField] ?? '')
      logImpersonationAction({
        sessionId: sid, adminId: currentUser.id, targetUserId: targetId,
        tableName, rowId, operation: 'insert',
        beforeState: null, afterState: result.data as Record<string, unknown>,
      }).catch(() => { /* silent — don't break the actual write */ })
    }
    return result
  }

  // Logged delete — captures before state, performs delete, queues soft delete if impersonating
  async function loggedDelete(
    tableName: string,
    rowId: string,
    pkField = 'id'
  ): Promise<{ data: unknown; error: unknown }> {
    const sid = impersonationSessionIdRef.current
    const targetId = impersonatedUserIdRef.current
    const currentUser = userRef.current

    if (sid && targetId && currentUser) {
      const { data: before } = await supabase.from(tableName).select('*').eq(pkField, rowId).single()
      const result = await supabase.from(tableName).delete().eq(pkField, rowId)
      if (before) {
        logImpersonationAction({
          sessionId: sid, adminId: currentUser.id, targetUserId: targetId,
          tableName, rowId, operation: 'delete',
          beforeState: before as Record<string, unknown>, afterState: null,
        }).then(actionId => {
          queueSoftDelete({ actionId, tableName, rowId, rowData: before as Record<string, unknown> }).catch(() => {})
        }).catch(() => {})
      }
      return result
    }
    return supabase.from(tableName).delete().eq(pkField, rowId)
  }

  async function signOut() {
    await stopImpersonation('session_end')
    await supabase.auth.signOut()
  }

  const effectiveUserId = impersonatedUserId ?? user?.id ?? null
  const impersonating = !!impersonatedUserId

  return (
    <AuthContext.Provider value={{
      user, session, loading, isAdmin, isOwner, hasAdminAccess, adminTabs, role, signOut,
      effectiveUserId, impersonating, impersonatedUserName,
      impersonationSessionId, impersonationExpiresAt,
      startImpersonation, stopImpersonation,
      loggedInsert, loggedDelete,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
