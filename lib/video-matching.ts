import {
  expandAndNormalize, hasUnilateralSignal, equipmentIn,
} from '@/lib/exercise-abbreviations'

// ─────────────────────────────────────────────────────────────────────────────
//  Local exercise -> video matching (Task 1).
//
//  This is what replaces search.list. Postgres does a cheap trigram prefilter
//  (match_channel_videos RPC, GIN index) to narrow ~6,000 cached uploads to a
//  handful of candidates, then the precise scoring happens here in Node where
//  it is readable and testable.
//
//  Scoring is deliberately transparent rather than clever: every component is
//  named and weighted, and scoreCandidate returns the reasons alongside the
//  number so a low match can be explained instead of guessed at.
//
//  The confidence threshold is NOT hardcoded. It gets chosen from a dry-run
//  score histogram against real data, and stays configurable.
// ─────────────────────────────────────────────────────────────────────────────

export type CachedVideo = {
  video_id: string
  channel_id: string
  title: string
  description: string
  sim?: number          // trigram similarity from the RPC prefilter, 0..1
}

export type MatchScore = {
  video: CachedVideo
  score: number         // 0..1
  reasons: string[]
}

const WEIGHTS = {
  titleTokenOverlap: 0.50,
  trigramSimilarity: 0.20,
  equipmentMatch:    0.15,
  unilateralMatch:   0.10,
  descriptionSupport:0.05,
}

/** Tokens worth ignoring: they appear in nearly every fitness video title. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'with', 'your', 'you',
  'how', 'best', 'exercise', 'exercises', 'workout', 'tutorial', 'form',
  'proper', 'do', 'this', 'of', 'in', 'on', 'is', 'it', 'guide', 'tips',
])

function contentTokens(text: string): string[] {
  return expandAndNormalize(text)
    .split(' ')
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
}

/**
 * The query string handed to the trigram prefilter. Abbreviations are expanded
 * so the Postgres side compares like with like.
 */
export function buildMatchQuery(exerciseName: string): string {
  return expandAndNormalize(exerciseName)
}

export function scoreCandidate(exerciseName: string, video: CachedVideo): MatchScore {
  const reasons: string[] = []
  const exTokens = contentTokens(exerciseName)
  const titleTokens = new Set(contentTokens(video.title))
  const descTokens = new Set(contentTokens(video.description))

  if (exTokens.length === 0) {
    return { video, score: 0, reasons: ['exercise name produced no content tokens'] }
  }

  // 1. How much of the exercise name appears in the video title.
  const inTitle = exTokens.filter(t => titleTokens.has(t))
  const titleOverlap = inTitle.length / exTokens.length
  if (titleOverlap === 1) reasons.push('every term in the title')
  else if (titleOverlap >= 0.5) reasons.push(`${inTitle.length}/${exTokens.length} terms in the title`)
  else reasons.push(`only ${inTitle.length}/${exTokens.length} terms in the title`)

  // 2. Trigram similarity from Postgres, when the prefilter supplied it.
  const trigram = typeof video.sim === 'number' ? Math.min(1, Math.max(0, video.sim)) : 0

  // 3. Equipment agreement. A dumbbell exercise matched to a barbell video is
  //    wrong even when every other word lines up, so a conflict is penalised
  //    rather than merely unrewarded.
  const exEquip = equipmentIn(exerciseName)
  const vidEquip = equipmentIn(`${video.title} ${video.description}`)
  let equipmentScore = 0.5
  if (exEquip.length === 0) {
    equipmentScore = 0.5
  } else if (exEquip.some(e => vidEquip.includes(e))) {
    equipmentScore = 1
    reasons.push(`equipment matches (${exEquip.join(', ')})`)
  } else if (vidEquip.length > 0) {
    equipmentScore = 0
    reasons.push(`equipment conflict: wants ${exEquip.join('/')}, video shows ${vidEquip.join('/')}`)
  }

  // 4. Unilateral agreement. This is the exact failure Task 6 has to clean up
  //    retroactively: single-arm exercises approved against both-arm demos.
  const exUni = hasUnilateralSignal(exerciseName)
  const vidUni = hasUnilateralSignal(`${video.title} ${video.description}`)
  let unilateralScore = 0.5
  if (exUni && vidUni) { unilateralScore = 1; reasons.push('both unilateral') }
  else if (exUni && !vidUni) { unilateralScore = 0; reasons.push('exercise is unilateral, video does not say so') }
  else if (!exUni && !vidUni) { unilateralScore = 1 }

  // 5. Weak supporting signal from the description.
  const inDesc = exTokens.filter(t => descTokens.has(t))
  const descSupport = inDesc.length / exTokens.length

  const score =
    WEIGHTS.titleTokenOverlap  * titleOverlap +
    WEIGHTS.trigramSimilarity  * trigram +
    WEIGHTS.equipmentMatch     * equipmentScore +
    WEIGHTS.unilateralMatch    * unilateralScore +
    WEIGHTS.descriptionSupport * descSupport

  return { video, score: Number(score.toFixed(4)), reasons }
}

/** Score every candidate and return them best first. */
export function rankCandidates(exerciseName: string, videos: CachedVideo[]): MatchScore[] {
  return videos
    .map(v => scoreCandidate(exerciseName, v))
    .sort((a, b) => b.score - a.score)
}

/** Histogram buckets for the dry run, so the threshold comes from real data. */
export function scoreHistogram(scores: number[], buckets = 10): { bucket: string; count: number }[] {
  const out = Array.from({ length: buckets }, (_, i) => ({
    bucket: `${(i / buckets).toFixed(1)}-${((i + 1) / buckets).toFixed(1)}`,
    count: 0,
  }))
  for (const s of scores) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(s * buckets)))
    out[idx].count++
  }
  return out
}
