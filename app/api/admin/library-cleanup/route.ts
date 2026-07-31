import { verifyAdmin } from '@/lib/admin-auth'
import { proposeName, isUnilateralName } from '@/lib/exercise-naming'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Task 6 (naming slice): review and apply exercise renames.
//
//  GET   returns proposals plus everything already attached to each exercise,
//        so Will can see the consequences BEFORE approving: does it have a
//        video, does that video contradict a unilateral name, does it have TTS
//        audio that will go stale.
//
//  POST  applies only the ids explicitly approved. Nothing is bulk-applied.
//
//  Why TTS matters here: generate-tts builds its narration starting with
//  ex.name_display, so the audio literally speaks the exercise name. Renaming
//  without clearing the audio leaves a file that still says "one D B chest
//  fly". Approved renames therefore null tts_url_male/female so the next TTS
//  run regenerates them correctly.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = 1000

type Row = {
  id: string
  name_display: string
  legacy_name: string | null
  video_url: string | null
  tts_url_male: string | null
  tts_url_female: string | null
  how: string | null
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const all: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await auth.supabase
      .from('exercise_library')
      .select('id, name_display, legacy_name, video_url, tts_url_male, tts_url_female, how')
      .order('name_display')
      .range(from, from + PAGE - 1)
    if (error) {
      return Response.json({
        error: error.message,
        hint: /legacy_name/.test(error.message)
          ? 'Run supabase/migrations/20260731_exercise_legacy_name.sql first.'
          : undefined,
      }, { status: 500 })
    }
    const rows = (data ?? []) as Row[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }

  const proposals = all
    .map(r => ({ row: r, p: proposeName(r.name_display) }))
    .filter(x => x.p.changed)
    .map(({ row, p }) => ({
      id: row.id,
      current: p.current,
      proposed: p.proposed,
      reasons: p.reasons,
      needsReview: p.needsReview,
      reviewNote: p.reviewNote,
      hasVideo: !!row.video_url,
      hasTts: !!(row.tts_url_male || row.tts_url_female),
      // Name says one side. If it already has a video approved before the
      // matcher had a unilateral gate, that video may well show both sides.
      unilateralRisk: isUnilateralName(row.name_display) && !!row.video_url,
      instructionsPreview: (row.how ?? '').slice(0, 160),
      alreadyRenamed: !!row.legacy_name,
    }))

  return Response.json({
    library_total: all.length,
    proposed_renames: proposals.length,
    with_video: proposals.filter(p => p.hasVideo).length,
    with_tts: proposals.filter(p => p.hasTts).length,
    needs_review: proposals.filter(p => p.needsReview).length,
    unilateral_video_risk: proposals.filter(p => p.unilateralRisk).length,
    // Library-wide, not just renames: every unilateral exercise carrying a
    // video approved before the gate existed.
    unilateral_video_risk_library_wide: all.filter(r => isUnilateralName(r.name_display) && !!r.video_url).length,
    tts_total_in_library: all.filter(r => r.tts_url_male || r.tts_url_female).length,
    proposals,
  })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'video')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const approvals: { id: string; proposed: string; requeueVideo?: boolean }[] =
    Array.isArray(body.approvals) ? body.approvals.slice(0, 500) : []
  if (!approvals.length) return Response.json({ error: 'No approvals supplied' }, { status: 400 })

  const ids = approvals.map(a => a.id)
  const { data: current } = await auth.supabase
    .from('exercise_library')
    .select('id, name_display, legacy_name, tts_url_male, tts_url_female, video_url')
    .in('id', ids)
  type ApplyRow = Omit<Row, 'how'>
  const byId = new Map((current ?? []).map((r: ApplyRow) => [r.id, r]))

  const renamed: string[] = []
  const ttsCleared: string[] = []
  const videosRequeued: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const a of approvals) {
    const row = byId.get(a.id)
    if (!row) { failed.push({ id: a.id, error: 'not found' }); continue }
    if (!a.proposed?.trim()) { failed.push({ id: a.id, error: 'empty name' }); continue }

    const hadTts = !!(row.tts_url_male || row.tts_url_female)

    const update: Record<string, unknown> = {
      name_display: a.proposed.trim(),
      // Only stamp the ORIGINAL name, so re-running never overwrites history.
      legacy_name: row.legacy_name ?? row.name_display,
    }
    // The narration speaks the name, so renamed audio is stale by definition.
    if (hadTts) { update.tts_url_male = null; update.tts_url_female = null }
    // Requeue means: drop the approved video so it re-enters the curation
    // backlog. Deliberately opt-in per row, never automatic.
    if (a.requeueVideo && row.video_url) {
      update.video_url = null
      update.video_source = null
      update.video_approved_at = null
      update.video_approved_by = null
      update.loop_start_sec = null
      update.loop_end_sec = null
    }

    const { error } = await auth.supabase.from('exercise_library').update(update).eq('id', a.id)
    if (error) { failed.push({ id: a.id, error: error.message }); continue }

    renamed.push(a.proposed.trim())
    if (hadTts) ttsCleared.push(a.proposed.trim())
    if (a.requeueVideo && row.video_url) videosRequeued.push(a.proposed.trim())
  }

  return Response.json({
    renamed: renamed.length,
    tts_cleared: ttsCleared.length,
    videos_requeued: videosRequeued.length,
    failed,
    next_step: ttsCleared.length
      ? `${ttsCleared.length} audio files cleared. Regenerate them from the TTS Audio tab.`
      : undefined,
  })
}
