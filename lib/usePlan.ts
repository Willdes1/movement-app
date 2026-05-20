'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export type PlanTier = 'free' | 'pro' | 'plus' | 'supreme'

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, plus: 2, supreme: 3 }

export function usePlan() {
  const { user, role, effectiveUserId } = useAuth()
  const [plan, setPlan] = useState<PlanTier>('free')
  const [loadingPlan, setLoadingPlan] = useState(true)

  // Admin/coach/beta/ff get full access regardless of plan
  const isPrivileged = role === 'admin' || role === 'coach' || role === 'beta' || role === 'ff'

  useEffect(() => {
    if (!user) { setLoadingPlan(false); return }
    if (isPrivileged) { setPlan('supreme'); setLoadingPlan(false); return }

    supabase
      .from('profiles')
      .select('plan')
      .eq('id', effectiveUserId ?? user.id)
      .single()
      .then(({ data }) => {
        setPlan((data?.plan as PlanTier) ?? 'free')
        setLoadingPlan(false)
      })
  }, [user, effectiveUserId, isPrivileged])

  function canAccess(minTier: PlanTier): boolean {
    if (isPrivileged) return true
    return TIER_RANK[plan] >= TIER_RANK[minTier]
  }

  return {
    plan,
    loadingPlan,
    isPro:     canAccess('pro'),
    isPlus:    canAccess('plus'),
    isSupreme: canAccess('supreme'),
    canAccess,
  }
}
