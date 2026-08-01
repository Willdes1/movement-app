// ─────────────────────────────────────────────────────────────────────────────
//  Forgiving search for exercise and movement names.
//
//  Plain substring matching fails people constantly, because exercise names are
//  full of punctuation that nobody types:
//
//    "Cat-Cow Stretch"  vs  "cat cow"   -> no match (hyphen)
//    "Cat-Cow Stretch"  vs  "catcow"    -> no match
//    "90/90 Hip Stretch" vs "90 90 hip" -> no match (slash)
//
//  Real users type whatever is in their head and misspell things. So we
//  normalise punctuation away on BOTH sides, match on tokens in any order, and
//  fall back to edit distance so a near miss becomes a suggestion instead of an
//  empty page.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip everything that is not a letter or digit: "Cat-Cow" and "cat cow" both become "catcow". */
export function normalizeForSearch(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function searchTokens(s: string): string[] {
  return (s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** Standard Levenshtein. Names are short, so the cost is irrelevant. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - editDistance(a, b) / max
}

export type SearchHit<T> = { item: T; score: number; fuzzy: boolean }

/**
 * Score one name against a query. Returns 0 for no match.
 * Higher is better: a name starting with the query beats one merely containing it.
 */
export function scoreName(query: string, name: string): { score: number; fuzzy: boolean } {
  const q = normalizeForSearch(query)
  if (!q) return { score: 1, fuzzy: false }

  const squashed = normalizeForSearch(name)

  // 1. Punctuation-insensitive containment. This is what fixes "cat cow".
  if (squashed.startsWith(q)) return { score: 1, fuzzy: false }
  if (squashed.includes(q)) return { score: 0.9, fuzzy: false }

  // 2. Every word the user typed appears somewhere, in any order.
  const qTokens = searchTokens(query)
  const nTokens = searchTokens(name)
  if (qTokens.length > 0 && qTokens.every(qt => nTokens.some(nt => nt.includes(qt)))) {
    return { score: 0.75, fuzzy: false }
  }

  // 3. Near miss: a typo. Suggestion territory, and it has to stay tight.
  //
  // Comparing the query against the WHOLE squashed name is useless for a typo:
  // "catcw" against "catcowstretch" scores terribly on length alone. A fixed
  // character window is no better, because it cuts mid-word ("catcowst").
  //
  // Compare against CUMULATIVE WORD PREFIXES instead: for "Cat-Cow Stretch"
  // that is "cat", "catcow", "catcowstretch". A user typing "catcw" is aiming
  // at "catcow", and that comparison scores 0.83.
  let prefixScore = 0
  let acc = ''
  for (const nt of nTokens) {
    acc += nt
    prefixScore = Math.max(prefixScore, similarity(q, acc))
  }
  const prefixClose = prefixScore >= 0.75

  // For multi-word queries, EVERY word must be close to something in the name.
  // Taking the best single pair instead would let "stretch cat" suggest
  // "90/90 Hip Stretch Long Hold" purely on the word "stretch".
  const perToken = qTokens.map(qt =>
    nTokens.reduce((best, nt) => Math.max(best, similarity(qt, nt)), 0))
  const allTokensClose = qTokens.length > 0 && perToken.every(s => s >= 0.7)

  if (prefixClose || allTokensClose) {
    const strength = Math.max(
      prefixClose ? prefixScore : 0,
      allTokensClose ? perToken.reduce((a, b) => a + b, 0) / perToken.length : 0,
    )
    return { score: strength * 0.6, fuzzy: true }
  }

  return { score: 0, fuzzy: false }
}

/**
 * Split a list into confident matches and "did you mean" suggestions.
 * Suggestions are only worth showing when there are no confident matches.
 */
export function searchItems<T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
  opts: { maxSuggestions?: number } = {},
): { matches: T[]; suggestions: T[] } {
  if (!query.trim()) return { matches: items, suggestions: [] }

  const scored: SearchHit<T>[] = []
  for (const item of items) {
    const { score, fuzzy } = scoreName(query, getName(item))
    if (score > 0) scored.push({ item, score, fuzzy })
  }
  scored.sort((a, b) => b.score - a.score)

  const matches = scored.filter(s => !s.fuzzy).map(s => s.item)
  const suggestions = scored.filter(s => s.fuzzy).slice(0, opts.maxSuggestions ?? 6).map(s => s.item)
  return { matches, suggestions }
}

/**
 * Keyword matching for the body-area buttons, with the same punctuation
 * blindness. The keyword "cat cow" has to match the movement "Cat-Cow Stretch".
 */
export function matchesAnyKeyword(name: string, keywords: string[]): boolean {
  const squashed = normalizeForSearch(name)
  return keywords.some(kw => squashed.includes(normalizeForSearch(kw)))
}
