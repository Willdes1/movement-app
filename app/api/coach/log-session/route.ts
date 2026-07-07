import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { verifiedInsert, verifiedUpdate, verifiedUpsert } from '@/lib/verified-write'

export const runtime = 'nodejs'
export const maxDuration = 60

type Entry = {
  exercise: string            // raw movement text, e.g. "Bench Press 3x8"
  exerciseNormalized: string
  existingLogId?: string      // today-log already created by the client — update it
  sets?: number | null
  reps?: number | null
  weight?: number | null
  note?: string
}

// Coach logs an in-person session on the client's behalf:
// workout_logs entries (logged_by = coach), optional day completion
// (completed_by = coach), session notes, and a push notification.
export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user: coach }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !coach) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      clientId, assignmentId, weekNumber, dayName, sessionDate,
      entries = [], sessionNote = '', completeDay = false,
    } = await request.json() as {
      clientId: string; assignmentId: string; weekNumber: number; dayName: string
      sessionDate: string; entries: Entry[]; sessionNote: string; completeDay: boolean
    }

    if (!clientId || !assignmentId || !weekNumber || !dayName) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Coach may only log for active clients on their own assignment
    const [{ data: roster }, { data: assignment }] = await Promise.all([
      supabase.from('coach_clients').select('id')
        .eq('coach_id', coach.id).eq('client_id', clientId).eq('status', 'active').maybeSingle(),
      supabase.from('coach_program_assignments').select('id')
        .eq('id', assignmentId).eq('coach_id', coach.id).eq('client_id', clientId).maybeSingle(),
    ])
    if (!roster || !assignment) return Response.json({ error: 'Client not in your roster' }, { status: 403 })

    // 1. Workout logs — update the client's existing entry or insert a new one.
    // Verified writes: a rejected/lost write now logs [VERIFY_FAIL] + a
    // harness_events row (loud) instead of being swallowed by `if (!error)`.
    // We keep the loop resilient — one bad entry doesn't lose the others — and
    // surface a `failed` count in the response so the coach knows.
    let logged = 0
    let failed = 0
    for (const e of entries) {
      const hasValues = e.sets != null || e.reps != null || e.weight != null
      if (!hasValues) continue
      try {
        if (e.existingLogId) {
          await verifiedUpdate(supabase, 'workout_logs', e.existingLogId,
            { sets: e.sets ?? null, reps: e.reps ?? null, weight: e.weight ?? null, logged_by: coach.id },
            { context: 'coach-log-session:update', match: { user_id: clientId }, expect: ['logged_by'], effectiveUserId: clientId })
        } else {
          await verifiedInsert(supabase, 'workout_logs', {
            user_id: clientId,
            exercise_normalized: e.exerciseNormalized,
            sets: e.sets ?? null, reps: e.reps ?? null, weight: e.weight ?? null,
            weight_unit: 'lbs',
            logged_by: coach.id,
          }, { context: 'coach-log-session:insert', expect: ['user_id', 'exercise_normalized', 'logged_by'], effectiveUserId: clientId })
        }
        logged++
      } catch {
        failed++ // already logged loud by the verify helper
      }
    }

    // 2. Session notes — session-level note + per-exercise notes combined
    const exerciseNotes = entries
      .filter(e => e.note?.trim())
      .map(e => `• ${e.exercise.trim()}: ${e.note!.trim()}`)
    const fullNote = [sessionNote.trim(), ...exerciseNotes].filter(Boolean).join('\n')
    if (fullNote) {
      await supabase.from('coach_client_notes').insert({
        coach_id: coach.id,
        client_id: clientId,
        note: fullNote.slice(0, 2000),
        session_date: sessionDate ?? new Date().toISOString().slice(0, 10),
      })
    }

    // 3. Day completion — verified so a lost completion write is loud, not silent.
    let completionFailed = false
    if (completeDay) {
      try {
        await verifiedUpsert(supabase, 'coach_day_completions',
          {
            user_id: clientId, assignment_id: assignmentId,
            week_number: weekNumber, day_name: dayName,
            skipped: false, completed_by: coach.id,
          },
          {
            onConflict: 'user_id,assignment_id,week_number,day_name',
            context: 'coach-day-completion',
            expect: ['user_id', 'assignment_id', 'week_number', 'day_name', 'completed_by'],
            effectiveUserId: clientId,
          })
      } catch {
        completionFailed = true // already logged loud by the verify helper
      }
    }

    // 4. Push notification — only when the coach completed the day for them
    let pushed = 0
    if (completeDay) {
      try {
        const { data: coachProfile } = await supabase.from('profiles').select('name').eq('id', coach.id).single()
        const coachFirst = coachProfile?.name?.split(' ')[0] ?? 'your coach'
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT!,
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        )
        const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', clientId)
        if (subs?.length) {
          const payload = JSON.stringify({
            title: 'Session complete 💪',
            body: `Good job! Looks like you crushed today's session with Coach ${coachFirst} — it's all logged for you.`,
            url: '/today',
          })
          const results = await Promise.allSettled(
            subs.map(sub =>
              webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              ).catch(async err => {
                if (err.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                throw err
              })
            )
          )
          pushed = results.filter(r => r.status === 'fulfilled').length
        }
      } catch { /* push is best-effort — never fail the log */ }
    }

    return Response.json({ success: true, logged, failed, pushed, completionFailed })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
