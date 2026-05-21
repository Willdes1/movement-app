import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const supabaseAdmin = getAdmin()
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabaseAdmin
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Already counted today — return as-is
  if (existing?.last_active_date === today) {
    return NextResponse.json({
      currentStreak: existing.current_streak,
      longestStreak: existing.longest_streak,
      isNewRecord: false,
    })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const wasYesterday = existing?.last_active_date === yesterdayStr
  const newStreak = wasYesterday ? (existing.current_streak ?? 0) + 1 : 1
  const newLongest = Math.max(newStreak, existing?.longest_streak ?? 0)
  const isNewRecord = newStreak > (existing?.longest_streak ?? 0)

  await supabaseAdmin.from('user_streaks').upsert({
    user_id: userId,
    current_streak: newStreak,
    longest_streak: newLongest,
    last_active_date: today,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({ currentStreak: newStreak, longestStreak: newLongest, isNewRecord })
}
