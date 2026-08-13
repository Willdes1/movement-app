import { logHarnessEvent } from '@/lib/harness-events'
import { verifyUser } from '@/lib/admin-auth'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
//  Zero-quota dead video reporting.
//
//  Instead of polling every stored video through the Data API every night, we
//  listen to what the YouTube player already tells us. When a real athlete
//  loads a real exercise and the video is gone, the IFrame player fires an
//  error and the client posts it here.
//
//  Costs no API quota, needs no cron, and only ever surfaces videos that
//  someone actually tried to watch.
//
//  Player error codes:
//    2        malformed video id
//    5        HTML5 player failure (usually transient, not a dead video)
//    100      video removed or made private
//    101/150  embedding disabled by the owner
//
//  Written to harness_events, so it appears in Admin -> Telemetry alongside
//  every other system alert. No new table.
// ─────────────────────────────────────────────────────────────────────────────

const FATAL_CODES: Record<number, string> = {
  2:   'malformed video id',
  100: 'video removed or made private',
  101: 'embedding disabled by the owner',
  150: 'embedding disabled by the owner',
}

export async function POST(req: Request) {
  try {
    const auth = await verifyUser(req)
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

    const body = await req.json().catch(() => ({}))
    const code = Number(body.code)
    const videoId = String(body.videoId ?? '').slice(0, 32)
    const exerciseName = String(body.exerciseName ?? '').slice(0, 200)
    const context = String(body.context ?? 'unknown').slice(0, 64)

    // 5 is usually a transient client-side playback hiccup rather than a dead
    // video, so it is deliberately not reported. Reporting it would train Will
    // to ignore these alerts.
    const reason = FATAL_CODES[code]
    if (!reason) return Response.json({ ok: true, ignored: true })
    if (!videoId) return Response.json({ ok: true, ignored: true })

    await logHarnessEvent({
      event_type: 'route_error',
      severity: 'warn',
      context: `video_unavailable:${context}`,
      message: `Dead video: ${exerciseName || '(unknown exercise)'} — ${reason} (code ${code})`,
      metadata: {
        kind: 'video_unavailable',
        video_id: videoId,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        exercise_name: exerciseName,
        player_error_code: code,
        reason,
        surface: context,
      },
    })

    return Response.json({ ok: true, reported: true, reason })
  } catch {
    // Never let a telemetry report break playback for the athlete.
    return Response.json({ ok: true, ignored: true })
  }
}
