// ─────────────────────────────────────────────────────────────────────────────
//  Minimal inline abbreviation map (Task 1).
//
//  TEMPORARY BY DESIGN. Task 6 builds the real, reviewable naming standard and
//  mapping table for the whole library. When it does, it seeds from this map and
//  THIS FILE GETS DELETED. Task 1 is not blocked waiting for Task 6, and Task 6
//  is not pulled forward. See the corrections block in
//  to-do/youtube-curation-queue.md.
//
//  Scope: just enough to stop local title matching failing on the abbreviations
//  that actually appear in exercise_library. Not a naming standard.
// ─────────────────────────────────────────────────────────────────────────────

/** Multi-word phrases, matched before single tokens (longest first). */
export const PHRASE_EXPANSIONS: [RegExp, string][] = [
  [/\b1\s*db\b/gi,   'single arm dumbbell'],
  [/\b1\s*kb\b/gi,   'single arm kettlebell'],
  [/\b1\s*arm\b/gi,  'single arm'],
  [/\b1\s*leg\b/gi,  'single leg'],
  [/\bs\/?a\b/gi,    'single arm'],
  [/\bs\/?l\b/gi,    'single leg'],
  [/\bdb\b/gi,       'dumbbell'],
  [/\bbb\b/gi,       'barbell'],
  [/\bkb\b/gi,       'kettlebell'],
  [/\bbw\b/gi,       'bodyweight'],
  [/\bez\b/gi,       'ez bar'],
  [/\bcbl\b/gi,      'cable'],
  [/\brdl\b/gi,      'romanian deadlift'],
  [/\bsldl\b/gi,     'stiff leg deadlift'],
  [/\bohp\b/gi,      'overhead press'],
  [/\bohs\b/gi,      'overhead squat'],
  [/\bbss\b/gi,      'bulgarian split squat'],
  [/\bgm\b/gi,       'good morning'],
  [/\bhspu\b/gi,     'handstand push up'],
  [/\bghd\b/gi,      'glute ham developer'],
  [/\bkbs\b/gi,      'kettlebell swing'],
  [/\balt\b/gi,      'alternating'],
  [/\brev\b/gi,      'reverse'],
  [/\bext\b/gi,      'extension'],
  [/\bflex\b/gi,     'flexion'],
  [/\babd\b/gi,      'abduction'],
  [/\badd\b/gi,      'adduction'],
  [/\bext\.?\s*rot\b/gi, 'external rotation'],
  [/\bint\.?\s*rot\b/gi, 'internal rotation'],
  [/\biso\b/gi,      'isometric'],
  [/\becc\b/gi,      'eccentric'],
  [/\bsmr\b/gi,      'self myofascial release'],
]

/** Equipment terms. Used both for expansion sanity and for match scoring. */
export const EQUIPMENT_TERMS = [
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight',
  'band', 'smith machine', 'trap bar', 'ez bar', 'medicine ball', 'sled',
  'landmine', 'suspension', 'foam roller',
] as const

/** Signals that an exercise trains one side at a time. */
export const UNILATERAL_TERMS = [
  'single arm', 'single leg', 'one arm', 'one leg', 'unilateral',
  'alternating', 'split squat', 'lunge', 'step up', 'pistol',
  'offset', 'staggered', 'b stance',
] as const

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Expand abbreviations, then normalize. Run this on BOTH sides of a match so
 * "1 DB Chest Fly" and "Single-Arm Dumbbell Chest Fly" converge on the same
 * token set.
 */
export function expandAndNormalize(input: string): string {
  let out = ` ${input ?? ''} `
  for (const [pattern, replacement] of PHRASE_EXPANSIONS) {
    out = out.replace(pattern, ` ${replacement} `)
  }
  return normalizeText(out)
}

export function hasUnilateralSignal(text: string): boolean {
  const t = expandAndNormalize(text)
  return UNILATERAL_TERMS.some(term => t.includes(term))
}

export function equipmentIn(text: string): string[] {
  const t = expandAndNormalize(text)
  return EQUIPMENT_TERMS.filter(term => t.includes(term))
}
