import { SupabaseClient } from '@supabase/supabase-js'
import { currentPeriod } from './coach-plans'

// Server-side coach usage tracking for billing gates. Counters live in
// coach_usage keyed by (coach_id, period_month) and reset each month. All
// functions degrade gracefully (return zero / no-op) if the table doesn't exist
// yet — usage tracking must never break the underlying action.

export type CoachUsage = { ai_programs_used: number; messages_used: number }

export async function getCoachUsage(svc: SupabaseClient, coachId: string): Promise<CoachUsage> {
  try {
    const { data } = await svc
      .from('coach_usage')
      .select('ai_programs_used, messages_used')
      .eq('coach_id', coachId)
      .eq('period_month', currentPeriod())
      .maybeSingle()
    return { ai_programs_used: data?.ai_programs_used ?? 0, messages_used: data?.messages_used ?? 0 }
  } catch {
    return { ai_programs_used: 0, messages_used: 0 }
  }
}

/** Increment one usage counter for the current period. Never throws. */
export async function bumpCoachUsage(
  svc: SupabaseClient,
  coachId: string,
  field: 'ai_programs_used' | 'messages_used',
  by = 1,
): Promise<void> {
  try {
    const cur = await getCoachUsage(svc, coachId)
    const next = (field === 'ai_programs_used' ? cur.ai_programs_used : cur.messages_used) + by
    await svc.from('coach_usage').upsert(
      { coach_id: coachId, period_month: currentPeriod(), [field]: next, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,period_month' },
    )
  } catch {
    /* usage tracking must not break the action it measures */
  }
}
