import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { exerciseNames } = await request.json().catch(() => ({}))
    if (!Array.isArray(exerciseNames) || exerciseNames.length === 0) {
      return Response.json({ queued: 0 })
    }

    // Find exercises in library that have no approved video yet
    const { data: noVideo } = await supabaseAdmin
      .from('exercise_library')
      .select('id, name_normalized')
      .in('name_normalized', exerciseNames)
      .is('video_url', null)

    if (!noVideo?.length) return Response.json({ queued: 0 })

    const exerciseIds = noVideo.map(e => e.id)

    // Skip any already proposed, approved, or queued
    const { data: existing } = await supabaseAdmin
      .from('exercise_video_candidates')
      .select('exercise_id')
      .in('exercise_id', exerciseIds)
      .in('status', ['proposed', 'approved', 'queued'])

    const alreadyHandled = new Set((existing ?? []).map(r => r.exercise_id))
    const toQueue = noVideo.filter(e => !alreadyHandled.has(e.id))

    if (!toQueue.length) return Response.json({ queued: 0 })

    await supabaseAdmin.from('exercise_video_candidates').insert(
      toQueue.map(e => ({ exercise_id: e.id, status: 'queued' }))
    )

    return Response.json({ queued: toQueue.length })
  } catch (err) {
    console.error('Queue exercise videos error:', err)
    return Response.json({ queued: 0 })
  }
}
