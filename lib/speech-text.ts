// Single source of truth for what the narrator says about an exercise.
//
// This MUST stay byte-identical to the text the batch generator uses in
// app/api/admin/generate-tts/route.ts, because that route is what produced the
// pre-generated MP3s sitting in exercise_library.tts_url_male / tts_url_female.
// If the two drift, live-generated audio says something different from the
// cached file for the same exercise, and the server read-through cache in
// /api/tts starts returning audio that does not match the requested text.
//
// Note the deliberate split on `tip`: the on-screen label is COMMON MISTAKES
// (see CLAUDE.md), but the spoken prefix is "Coaching tip:" because that is
// what every already-generated file says.

export type SpeechSource = {
  name_display: string
  how?: string | null
  breathing?: string | null
  core?: string | null
  tip?: string | null
}

export type SpeechSectionId = 'how' | 'breathing' | 'core' | 'tip'

export type SpeechSection = {
  id: SpeechSectionId
  label: string
  /** Raw column text, for on-screen display. */
  body: string
  /** What the narrator reads, prefix included. */
  spoken: string
}

const SECTION_META: { id: SpeechSectionId; label: string; prefix: string }[] = [
  { id: 'how', label: 'HOW TO PERFORM', prefix: '' },
  { id: 'breathing', label: 'BREATHING', prefix: 'Breathing: ' },
  { id: 'core', label: 'CORE ENGAGEMENT', prefix: 'Core engagement: ' },
  { id: 'tip', label: 'COMMON MISTAKES', prefix: 'Coaching tip: ' },
]

/** The sections that actually have content, in narration order. */
export function speechSections(ex: SpeechSource): SpeechSection[] {
  return SECTION_META.flatMap(({ id, label, prefix }) => {
    const body = ex[id]
    if (!body) return []
    return [{ id, label, body, spoken: prefix + body }]
  })
}

/** The full narration: name, then every populated section. */
export function buildSpeechText(ex: SpeechSource): string {
  return [ex.name_display, ...speechSections(ex).map(s => s.spoken)].join('. ')
}
