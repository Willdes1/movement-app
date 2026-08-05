import { verifyAdmin } from '@/lib/admin-auth'
import { isUnilateralName } from '@/lib/exercise-naming'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 6, item 4: unilateral video recleanup.
//
//  READ ONLY. This route counts and lists. It resets nothing. Will's spec asks
//  for the size of the job before anything is touched, so the reset is a
//  separate, explicitly approved action.
//
//  Why this exists when the Library Cleanup tab already shows a unilateral
//  count: that count only covers exercises that ALSO have a rename proposal,
//  and requeueing a video there is a checkbox attached to a rename. An exercise
//  that was always correctly named, "Single-Arm Dumbbell Row" for instance,
//  never appears in that list, so its video could not be requeued at all. Those
//  are exactly the ones approved before the matcher had a unilateral gate.
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  id: string
  name_display: string
  video_url: string | null
  video_source: string | null
  video_approved_at: string | null
  loop_start_sec: number | null
  loop_end_sec: number | null
  youtube_start_sec: number | null
  youtube_end_sec: number | null
  legacy_name: string | null
}

// PostgREST caps an unbounded select at 1,000 rows and the library is larger
// than that, so page explicitly. Getting this wrong is how Video Curation ended
// up blind to half the library.
const PAGE = 1000

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const all: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await auth.supabase
      .from('exercise_library')
      .select('id, name_display, video_url, video_source, video_approved_at, loop_start_sec, loop_end_sec, youtube_start_sec, youtube_end_sec, legacy_name')
      .order('name_display')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data?.length) break
    all.push(...(data as Row[]))
    if (data.length < PAGE) break
  }

  const unilateral = all.filter(r => isUnilateralName(r.name_display) || isUnilateralName(r.legacy_name ?? ''))
  const withVideo = unilateral.filter(r => !!r.video_url)

  const items = withVideo.map(r => ({
    id: r.id,
    name: r.name_display,
    legacyName: r.legacy_name,
    videoUrl: r.video_url,
    videoSource: r.video_source,
    approvedAt: r.video_approved_at,
    // A trimmed clip was watched by a human at least once, so it is likelier to
    // be right. Untrimmed is the higher-risk pile and worth doing first.
    trimmed: r.loop_start_sec != null || r.youtube_start_sec != null,
    // The name only reads as unilateral once renamed, so the video was approved
    // against the old abbreviated name and never re-checked.
    renamedSince: !!r.legacy_name,
  }))

  return Response.json({
    library_total: all.length,
    unilateral_total: unilateral.length,
    unilateral_with_video: withVideo.length,
    unilateral_without_video: unilateral.length - withVideo.length,
    trimmed: items.filter(i => i.trimmed).length,
    untrimmed: items.filter(i => !i.trimmed).length,
    renamed_since_approval: items.filter(i => i.renamedSince).length,
    items,
  })
}

// Send the named videos back to the curation queue: approval cleared, so they
// reappear as un-curated and get matched again against the corrected name.
//
// Only the ids explicitly sent. There is no "requeue everything" here on
// purpose, and the UI makes you confirm the count first.
export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 500) : []
  if (!ids.length) return Response.json({ error: 'No exercises selected' }, { status: 400 })

  const { data: rows, error: readErr } = await auth.supabase
    .from('exercise_library')
    .select('id, name_display, video_url')
    .in('id', ids)
  if (readErr) return Response.json({ error: readErr.message }, { status: 500 })

  const requeued: string[] = []
  const skipped: string[] = []
  const failed: { name: string; error: string }[] = []

  for (const row of (rows ?? []) as { id: string; name_display: string; video_url: string | null }[]) {
    // Nothing to send back if there is no approved video on it.
    if (!row.video_url) { skipped.push(row.name_display); continue }

    const { error } = await auth.supabase
      .from('exercise_library')
      .update({
        video_url: null,
        video_source: null,
        video_approved_at: null,
        video_approved_by: null,
        // Trim windows describe the video that was just removed, so they have
        // to go with it. The rename path clears loop_* but leaves youtube_*
        // behind, which strands a clip window pointing at nothing.
        loop_start_sec: null,
        loop_end_sec: null,
        youtube_start_sec: null,
        youtube_end_sec: null,
      })
      .eq('id', row.id)

    if (error) failed.push({ name: row.name_display, error: error.message })
    else requeued.push(row.name_display)
  }

  return Response.json({ requeued: requeued.length, skipped: skipped.length, failed, names: requeued })
}
