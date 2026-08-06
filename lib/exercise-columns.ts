// One definition of what an exercise looks like when it is shown to a human.
//
// Task 6 item 1. Before this, every surface wrote its own select list and they
// had drifted apart. The audit in docs/library-render-audit.md has the full
// picture; the short version is that /plan asked for no video and no audio
// columns at all, so its exercise sheet could not show either even when the
// exercise had both, and /recovery/anatomy silently dropped core engagement.
// Those are not styling differences. They are pages showing an athlete less
// than we have.
//
// Import the constant instead of typing a select list, and a surface cannot
// quietly fall behind the others again.

/** Everything needed to render an exercise in full: cues, video, narration. */
export const EXERCISE_DISPLAY_COLUMNS = [
  'name_normalized',
  'name_display',
  'how',
  'breathing',
  'core',
  'tip',
  'video_url',
  'video_source',
  'youtube_start_sec',
  'youtube_end_sec',
  'loop_start_sec',
  'loop_end_sec',
  'tts_url_male',
  'tts_url_female',
].join(', ')

export type ExerciseDisplayRow = {
  name_normalized: string
  name_display: string
  how: string | null
  breathing: string | null
  core: string | null
  tip: string | null
  video_url: string | null
  video_source: string | null
  youtube_start_sec: number | null
  youtube_end_sec: number | null
  loop_start_sec: number | null
  loop_end_sec: number | null
  tts_url_male: string | null
  tts_url_female: string | null
}

/**
 * For lists that only need to render a name, like the workout log. Deliberately
 * separate rather than a comment on a wide select: a genuinely narrow need is
 * fine, silently drifting from the full shape is not.
 */
export const EXERCISE_NAME_COLUMNS = 'name_normalized, name_display'
