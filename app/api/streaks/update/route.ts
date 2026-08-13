import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveActingUser } from '@/lib/admin-auth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { userId: bodyUserId } = await req.json()

  // Identity from the JWT, not the body. Admins may still pass an id so Zoom In
  // keeps updating the impersonated athlete's streak rather than the admin's.
  const auth = await resolveActingUser(req, bodyUserId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const userId = auth.userId

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
