'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export type StreakData = {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  loading: boolean
}

export function useStreak(): StreakData & { refresh: () => void } {
  const { user, effectiveUserId } = useAuth()
  const [data, setData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    loading: true,
  })

  const userId = effectiveUserId ?? user?.id

  const fetch = useCallback(() => {
    if (!userId) { setData(d => ({ ...d, loading: false })); return }
    supabase
      .from('user_streaks')
      .select('current_streak, longest_streak, last_active_date')
      .eq('user_id', userId)
      .single()
      .then(({ data: row }) => {
        setData({
          currentStreak: row?.current_streak ?? 0,
          longestStreak: row?.longest_streak ?? 0,
          lastActiveDate: row?.last_active_date ?? null,
          loading: false,
        })
      })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { ...data, refresh: fetch }
}

export async function updateStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; isNewRecord: boolean }> {
  const res = await fetch('/api/streaks/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return res.json()
}
