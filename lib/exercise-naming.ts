// ─────────────────────────────────────────────────────────────────────────────
//  Task 6 (naming slice): propose full descriptive names for abbreviated
//  exercises.
//
//  Rules agreed with Will, 2026-07-31:
//    1. Expand every abbreviation into its full word. Full names read better.
//    2. KEEP whatever equipment the name actually states. "Single Arm Row" is
//       ambiguous (cable? dumbbell? machine?), and equipment drives both video
//       matching and the Task 9 vendor export.
//    3. NEVER invent equipment. If a name does not say what it uses, flag it
//       for review rather than guessing.
//    4. Leave correct names alone. "Bent-Over Barbell Row" is already right and
//       must not appear in the mapping at all.
//
//  Nothing here writes to the database. It produces a proposal that Will
//  reviews and approves per row.
// ─────────────────────────────────────────────────────────────────────────────

export type NameProposal = {
  current: string
  proposed: string
  changed: boolean
  reasons: string[]
  /** True when a human should look closely before approving. */
  needsReview: boolean
  reviewNote?: string
}

type Rule = {
  pattern: RegExp
  replacement: string
  label: string
  /** Expansions that are genuinely ambiguous get surfaced rather than trusted. */
  review?: string
}

// Order matters: longer, more specific patterns first, so "1 DB" is consumed
// before the bare "DB" rule can see it.
const RULES: Rule[] = [
  // Unilateral + equipment combinations
  { pattern: /\b1\s*[-–]?\s*DB\b/gi,  replacement: 'Single-Arm Dumbbell',    label: '1 DB → Single-Arm Dumbbell' },
  { pattern: /\b1\s*[-–]?\s*KB\b/gi,  replacement: 'Single-Arm Kettlebell',  label: '1 KB → Single-Arm Kettlebell' },
  { pattern: /\b1\s*[-–]?\s*Arm\b/gi, replacement: 'Single-Arm',             label: '1 Arm → Single-Arm' },
  { pattern: /\b1\s*[-–]?\s*Leg\b/gi, replacement: 'Single-Leg',             label: '1 Leg → Single-Leg' },
  { pattern: /\bOne\s+Arm\b/gi,       replacement: 'Single-Arm',             label: 'One Arm → Single-Arm' },
  { pattern: /\bOne\s+Leg\b/gi,       replacement: 'Single-Leg',             label: 'One Leg → Single-Leg' },
  { pattern: /\bS\/?A\b/g,            replacement: 'Single-Arm',             label: 'SA → Single-Arm' },
  { pattern: /\bS\/?L\b/g,            replacement: 'Single-Leg',             label: 'SL → Single-Leg' },

  // Named lifts (before bare equipment rules)
  { pattern: /\bSLDL\b/gi, replacement: 'Stiff-Leg Deadlift',     label: 'SLDL → Stiff-Leg Deadlift' },
  { pattern: /\bRDL\b/gi,  replacement: 'Romanian Deadlift',      label: 'RDL → Romanian Deadlift' },
  { pattern: /\bOHP\b/gi,  replacement: 'Overhead Press',         label: 'OHP → Overhead Press' },
  { pattern: /\bOHS\b/gi,  replacement: 'Overhead Squat',         label: 'OHS → Overhead Squat' },
  { pattern: /\bBSS\b/gi,  replacement: 'Bulgarian Split Squat',  label: 'BSS → Bulgarian Split Squat' },
  { pattern: /\bGHD\b/gi,  replacement: 'Glute-Ham Developer',    label: 'GHD → Glute-Ham Developer' },
  { pattern: /\bHSPU\b/gi, replacement: 'Handstand Push-Up',      label: 'HSPU → Handstand Push-Up' },
  { pattern: /\bKBS\b/gi,  replacement: 'Kettlebell Swing',       label: 'KBS → Kettlebell Swing' },

  // Equipment
  { pattern: /\bDB\b/gi,           replacement: 'Dumbbell',        label: 'DB → Dumbbell' },
  { pattern: /\bBB\b/gi,           replacement: 'Barbell',         label: 'BB → Barbell' },
  { pattern: /\bKB\b/gi,           replacement: 'Kettlebell',      label: 'KB → Kettlebell' },
  { pattern: /\bCBL\b/gi,          replacement: 'Cable',           label: 'CBL → Cable' },
  { pattern: /\bBW\b/gi,           replacement: 'Bodyweight',      label: 'BW → Bodyweight' },
  // The guard must allow for a SPACE. An earlier version used (?!-?Bar), which
  // only blocked when "Bar" followed immediately, so "EZ Bar Curl" became
  // "EZ-Bar Bar Curl". Four rows in the live library were renamed that way.
  { pattern: /\bEZ\b(?!\s*-?\s*Bar\b)/gi, replacement: 'EZ-Bar',    label: 'EZ → EZ-Bar' },
  { pattern: /\bEZ\s+Bar\b/gi,            replacement: 'EZ-Bar',    label: 'EZ Bar → EZ-Bar' },
  { pattern: /\bMB\b/gi,           replacement: 'Medicine Ball',   label: 'MB → Medicine Ball' },
  { pattern: /\bRes(?:istance)?\s*Bands?\b/gi, replacement: 'Resistance Band', label: 'Res Band → Resistance Band' },

  // Modifiers.
  //
  // Note the shape: \bAlt\b\.? and NOT \bAlt\.?\b. The second one looks right
  // and cannot work. In "Alt. DB Curls" the \.? consumes the dot and then \b
  // has to match between "." and " ", which are both non-word characters, so
  // there is no boundary there. The regex backtracks, matches "Alt" alone and
  // leaves the dot behind: "Alt. DB Curls" became "Alternating. Dumbbell
  // Curls", which the narration then reads with a full stop in the middle.
  // Putting \b before the optional dot lets the dot actually be consumed.
  { pattern: /\bAlt\b\.?/gi,  replacement: 'Alternating', label: 'Alt → Alternating' },
  { pattern: /\bRev\b\.?/gi,  replacement: 'Reverse',     label: 'Rev → Reverse' },
  { pattern: /\bIso\b\.?/gi,  replacement: 'Isometric',   label: 'Iso → Isometric' },
  { pattern: /\bEcc\b\.?/gi,  replacement: 'Eccentric',   label: 'Ecc → Eccentric' },
  { pattern: /\bAbd\b\.?/gi,  replacement: 'Abduction',   label: 'Abd → Abduction' },
  { pattern: /\bAdd\b\.?/gi,  replacement: 'Adduction',   label: 'Add → Adduction',
    review: '"Add" is ambiguous. Confirm this means adduction.' },

  // Rotation: "Ext Rot" must be handled before bare "Ext", because Ext means
  // External here and Extension everywhere else.
  { pattern: /\bExt\b\.?\s*Rot\b\.?/gi, replacement: 'External Rotation', label: 'Ext Rot → External Rotation' },
  { pattern: /\bInt\b\.?\s*Rot\b\.?/gi, replacement: 'Internal Rotation', label: 'Int Rot → Internal Rotation' },
  { pattern: /\bExt\b\.?/gi,            replacement: 'Extension',         label: 'Ext → Extension',
    review: '"Ext" can mean Extension or External. Confirm which.' },

  // Repair pass for names already applied with the broken rule above. A full
  // stop after one of these words, mid-name or trailing, is always that
  // artifact: exercise names are labels, not sentences. Without this the
  // corrected rule would leave those rows stranded, because their names no
  // longer contain the abbreviation it matches on.
  { pattern: /\b(Alternating|Reverse|Isometric|Eccentric|Abduction|Adduction|Extension|External|Internal|Rotation)\.(?=\s|$)/g,
    replacement: '$1', label: 'strip stray full stop left by the old Alt./Rev. rule' },
]

/** Unilateral without any equipment stated: we refuse to guess. */
const UNILATERAL_RE = /\bSingle-(Arm|Leg)\b/i
const EQUIPMENT_RE = /\b(Dumbbell|Barbell|Kettlebell|Cable|Machine|Bodyweight|Resistance Band|Smith|Trap Bar|EZ-Bar|Medicine Ball|Landmine|Sled|Band)\b/i

export function proposeName(current: string): NameProposal {
  const original = (current ?? '').trim()
  let working = original
  const reasons: string[] = []
  let needsReview = false
  let reviewNote: string | undefined

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    if (!rule.pattern.test(working)) continue
    rule.pattern.lastIndex = 0
    working = working.replace(rule.pattern, rule.replacement)
    reasons.push(rule.label)
    if (rule.review) { needsReview = true; reviewNote = rule.review }
  }

  // ── Repair pass ───────────────────────────────────────────────────────────
  // Cleans up damage a substitution can cause, including damage already written
  // to the database by an earlier version of these rules. Runs unconditionally
  // so the cleanup tab proposes a fix for rows that are already wrong.
  const REPAIRS: [RegExp, string, string][] = [
    // "EZ-Bar Bar Curl" -> "EZ-Bar Curl". Caused by the old EZ guard.
    [/\b(EZ|Trap|Safety)-Bar\s+Bar\b/gi, '$1-Bar', 'removed duplicated "Bar"'],
    // Any word immediately repeated, e.g. "Dumbbell Dumbbell Row".
    [/\b(\w+)\s+\1\b/gi, '$1', 'removed a repeated word'],
  ]
  for (const [pattern, replacement, label] of REPAIRS) {
    if (pattern.test(working)) {
      pattern.lastIndex = 0
      working = working.replace(pattern, replacement)
      reasons.push(label)
    }
    pattern.lastIndex = 0
  }

  // Tidy spacing and stray punctuation introduced by substitution.
  working = working.replace(/\s{2,}/g, ' ').replace(/\s+([),])/g, '$1').trim()

  const changed = working !== original

  // Rule 3: never invent equipment. Flag, do not guess.
  if (changed && UNILATERAL_RE.test(working) && !EQUIPMENT_RE.test(working)) {
    needsReview = true
    reviewNote = 'Unilateral but no equipment stated. Add the real equipment (dumbbell, cable, band) yourself rather than letting this ship ambiguous.'
  }

  return { current: original, proposed: working, changed, reasons, needsReview, reviewNote }
}

/**
 * Name says one side, but the attached video may show both. This is the error
 * that got baked into videos approved before the matcher had a unilateral gate.
 */
export function isUnilateralName(name: string): boolean {
  return /\b(single[- ]arm|single[- ]leg|one[- ]arm|one[- ]leg|1\s*(db|kb|arm|leg)\b|alternating|offset|staggered|unilateral|s\/?a\b|s\/?l\b)/i.test(name ?? '')
}
