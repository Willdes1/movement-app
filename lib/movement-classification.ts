import { normalizeText } from '@/lib/exercise-abbreviations'

// ─────────────────────────────────────────────────────────────────────────────
//  Splits the library into two tracks that need completely different handling.
//
//  'fitness' — gym and rehab movement. Demonstrations exist in quantity on the
//              approved channels, so local matching against the cached uploads
//              index should find them.
//
//  'trick'   — action-sport trick content (skate, BMX, scooter, snowboard...).
//              Will's call, 2026-07-29: most of these are simply not on YouTube
//              as clean demonstrations. They are "trick tips" phrased as
//              questions ("how do I 180 spin", "how to manual"). These should
//              NOT enter the curation queue, should NOT burn paid fallback
//              calls, and should be left video-blank so he can post his own
//              footage later. Written instructions carry them meanwhile, and
//              they get split out of the Task 9 vendor export because they are
//              not publicly available anywhere.
//
//  Classification is heuristic and deliberately conservative: it would rather
//  leave something in 'fitness' than wrongly pull a real gym exercise out of
//  curation. Counts are always reported for review before anything is written.
// ─────────────────────────────────────────────────────────────────────────────

export type Track = 'fitness' | 'trick'

/** Sport tags that make everything under them trick content. */
const ACTION_SPORT_HINTS = [
  'skate', 'skateboard', 'bmx', 'scooter', 'snowboard', 'ski', 'skiing',
  'surf', 'wakeboard', 'wakeskate', 'motocross', 'freestyle', 'parkour',
  'rollerblade', 'inline skate', 'longboard', 'trick',
]

/** Tokens that only ever appear in trick names. One is enough. */
const STRONG_TRICK_TOKENS = [
  'ollie', 'nollie', 'kickflip', 'heelflip', 'shuvit', 'shuv', 'tailwhip',
  'barspin', 'turndown', 'tailslide', 'noseslide', 'boardslide', 'bluntslide',
  'feeble', 'smith grind', 'crooked grind', 'lipslide', 'darkslide',
  'fakie', 'nosegrab', 'melon', 'indy grab', 'tuck no hander', 'superman seat grab',
  'bunny hop', 'wallride', 'footplant', 'no hander', 'can can',
]

/** Weaker signals. Two or more together indicate a trick. */
const WEAK_TRICK_TOKENS = [
  'manual', 'grind', 'spin', 'grab', 'stall', 'revert', 'switch', 'regular',
  'goofy', 'backside', 'frontside', 'transfer', 'drop in', 'air', 'rail',
  'ledge', 'ramp', 'halfpipe', 'quarterpipe', 'bowl', 'coping', 'deck',
]

/** Rotation degrees: 180, 360, 540, 720, 900, 1080. */
const ROTATION_RE = /\b(180|270|360|450|540|630|720|900|1080)\b/

export type Classification = {
  track: Track
  confidence: number      // 0..1
  reasons: string[]
}

export function classifyMovement(
  nameDisplay: string,
  sourceProgram?: string | null,
): Classification {
  const name = normalizeText(nameDisplay)
  const source = normalizeText(sourceProgram ?? '')
  const reasons: string[] = []

  // 1. The sport tag is the strongest signal we have.
  const sportHit = ACTION_SPORT_HINTS.find(h => source.includes(h))
  if (sportHit) reasons.push(`sport tag "${sportHit}"`)

  // 2. Unambiguous trick vocabulary.
  const strongHit = STRONG_TRICK_TOKENS.find(t => name.includes(t))
  if (strongHit) reasons.push(`trick term "${strongHit}"`)

  // 3. Rotation degrees.
  const rotation = ROTATION_RE.test(name)
  if (rotation) reasons.push('rotation degrees in the name')

  // 4. Weaker vocabulary, counted.
  const weakHits = WEAK_TRICK_TOKENS.filter(t => name.includes(t))
  if (weakHits.length) reasons.push(`trick vocabulary: ${weakHits.join(', ')}`)

  // Decide. Conservative: a weak signal alone is never enough, because words
  // like "air", "switch" and "manual" appear in legitimate gym exercises
  // (air squat, switch lunge, manual resistance).
  let track: Track = 'fitness'
  let confidence = 0

  // A sport tag ALONE is never enough. Library Builder seeds legitimate gym
  // work under sport categories: "Anti-Rotation Press" under Skiing, "Arched
  // Back Body Tension Hold" under Surfing. The first pass wrongly pulled those
  // out of curation. A false positive silently removes a real exercise from
  // curation forever; a false negative just wastes one free local match. The
  // asymmetry says: require trick vocabulary, not just a sport tag.
  if (strongHit) { track = 'trick'; confidence = 0.95 }
  else if (sportHit && (rotation || weakHits.length >= 1)) { track = 'trick'; confidence = 0.9 }
  else if (rotation && weakHits.length >= 1) { track = 'trick'; confidence = 0.8 }
  else if (weakHits.length >= 2) { track = 'trick'; confidence = 0.6 }
  else if (rotation) { track = 'trick'; confidence = 0.55 }

  if (track === 'fitness') reasons.length = 0
  return { track, confidence, reasons }
}
