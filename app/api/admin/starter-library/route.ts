import { verifyAdmin } from '@/lib/admin-auth'
import {
  ALL_STARTER_EXERCISES, STARTER_EXERCISES, STARTER_WORKOUTS,
  normalizeExerciseName,
} from '@/lib/coach-starter-library'
import { scoreName } from '@/lib/fuzzy-search'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
//  Coach starter library: coverage scan.
//
//  READ ONLY. Seeds nothing, generates nothing, spends nothing.
//
//  Answers the question Will asked: of the standard exercises we want waiting
//  in every new coach's library, which already have written instructions and
//  narration audio, and which are gaps we would need to fill first.
//
//  Matching is by name_normalized against exercise_library, the same key every
//  other surface uses, so a match here means the coach inherits the real row
//  with its cues, its curated video and its audio, at zero token cost.
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  id: string
  name_normalized: string
  name_display: string
  how: string | null
  breathing: string | null
  core: string | null
  tip: string | null
  video_url: string | null
  tts_url_male: string | null
  tts_url_female: string | null
}

const PAGE = 1000

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'seed')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wanted = new Set(ALL_STARTER_EXERCISES.map(normalizeExerciseName))

  // Page explicitly. PostgREST caps unbounded selects at 1,000 and the library
  // is larger than that, which is how Video Curation once went blind to half of it.
  const byKey = new Map<string, Row>()
  const everyRow: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await auth.supabase
      .from('exercise_library')
      .select('id, name_normalized, name_display, how, breathing, core, tip, video_url, tts_url_male, tts_url_female')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data?.length) break
    for (const r of data as Row[]) {
      everyRow.push(r)
      if (wanted.has(r.name_normalized)) byKey.set(r.name_normalized, r)
    }
    if (data.length < PAGE) break
  }

  // An exact key miss usually is not a missing movement, it is a naming
  // variant: plural, a word ordered differently, or an abbreviation we have
  // since expanded. Generating those would create a duplicate of an exercise we
  // already wrote and already paid for, which is the exact opposite of the
  // point. So every miss gets a fuzzy pass before it is called a gap.
  function nearestMatch(name: string) {
    let best: { row: Row; score: number } | null = null
    for (const row of everyRow) {
      const { score } = scoreName(name, row.name_display)
      if (score > 0 && (!best || score > best.score)) best = { row, score }
    }
    if (!best || best.score < 0.45) return null
    return {
      libraryName: best.row.name_display,
      normalized: best.row.name_normalized,
      score: Number(best.score.toFixed(2)),
      hasInstructions: !!best.row.how,
      hasTts: !!(best.row.tts_url_male || best.row.tts_url_female),
      hasVideo: !!best.row.video_url,
    }
  }

  const groups = STARTER_EXERCISES.map(g => ({
    key: g.key,
    label: g.label,
    exercises: g.exercises.map(name => {
      const row = byKey.get(normalizeExerciseName(name))
      return {
        name,
        normalized: normalizeExerciseName(name),
        inLibrary: !!row,
        // Only computed for misses, and only to stop us generating a duplicate.
        nearMatch: row ? null : nearestMatch(name),
        // name_display can differ from what we asked for, which is useful to
        // see: it means the library calls this movement something else.
        libraryName: row?.name_display ?? null,
        hasInstructions: !!row?.how,
        hasFullInstructions: !!(row?.how && row?.breathing && row?.core && row?.tip),
        hasTts: !!(row?.tts_url_male || row?.tts_url_female),
        hasVideo: !!row?.video_url,
      }
    }),
  }))

  const flat = groups.flatMap(g => g.exercises)

  return Response.json({
    total: flat.length,
    in_library: flat.filter(e => e.inLibrary).length,
    missing_entirely: flat.filter(e => !e.inLibrary).length,
    with_instructions: flat.filter(e => e.hasInstructions).length,
    with_full_instructions: flat.filter(e => e.hasFullInstructions).length,
    with_tts: flat.filter(e => e.hasTts).length,
    with_video: flat.filter(e => e.hasVideo).length,
    // Split the misses. Only the ones with no plausible match are real gaps;
    // the rest just need our list renamed to match what the library calls them.
    probably_renames: flat.filter(e => !e.inLibrary && e.nearMatch).length,
    // What a one-time fill would have to do, in priority order.
    needs_creating: flat.filter(e => !e.inLibrary && !e.nearMatch).map(e => e.name),
    rename_candidates: flat.filter(e => !e.inLibrary && e.nearMatch)
      .map(e => ({ ours: e.name, library: e.nearMatch!.libraryName, score: e.nearMatch!.score })),
    needs_instructions: flat.filter(e => e.inLibrary && !e.hasInstructions).map(e => e.name),
    needs_tts: flat.filter(e => e.inLibrary && e.hasInstructions && !e.hasTts).map(e => e.name),
    groups,
    workouts: STARTER_WORKOUTS.map(w => ({
      key: w.key,
      name: w.name,
      purpose: w.purpose,
      exercises: w.exercises,
      // A template is only usable if every movement in it resolves.
      ready: w.exercises.every(n => byKey.has(normalizeExerciseName(n))),
      missing: w.exercises.filter(n => !byKey.has(normalizeExerciseName(n))),
    })),
  })
}
