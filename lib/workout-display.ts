// Display-only helpers shared by the dashboard (today) + calendar day view.
// No AI tokens — equipment is inferred from exercise names; rest guidance is static copy.

const EQUIPMENT_KEYWORDS: { kw: RegExp; label: string }[] = [
  { kw: /barbell|deadlift|bench press|back squat|front squat|overhead press|\bclean\b|snatch|romanian|\brdl\b/i, label: 'Barbell' },
  { kw: /dumbbell|\bdb\b|goblet/i, label: 'Dumbbells' },
  { kw: /kettlebell|\bkb\b|\bswing/i, label: 'Kettlebell' },
  { kw: /\bband\b|banded|resistance band/i, label: 'Resistance band' },
  { kw: /cable|pulldown|lat pull|face pull|pushdown/i, label: 'Cable' },
  { kw: /pull[- ]?up|chin[- ]?up|dead hang|\bhang\b/i, label: 'Pull-up bar' },
  { kw: /bench|incline|decline/i, label: 'Bench' },
  { kw: /box jump|step[- ]?up|\bbox\b/i, label: 'Box / step' },
  { kw: /medicine ball|med ball|wall ball|slam ball/i, label: 'Medicine ball' },
  { kw: /\btrx\b|suspension/i, label: 'TRX' },
  { kw: /machine|leg press|hack squat|leg curl|leg extension/i, label: 'Machine' },
  { kw: /jump rope|skip rope|skipping/i, label: 'Jump rope' },
  { kw: /foam roll/i, label: 'Foam roller' },
  { kw: /\bmat\b|plank|crunch|sit[- ]?up|stretch/i, label: 'Mat' },
]

export function inferEquipment(names: string[]): string[] {
  const found: string[] = []
  for (const { kw, label } of EQUIPMENT_KEYWORDS) {
    if (found.includes(label)) continue
    if (names.some(n => kw.test(n))) found.push(label)
  }
  return found.length ? found.slice(0, 6) : ['Bodyweight']
}

export function timeCommitment(duration: string | undefined): string {
  const nums = (duration ?? '').match(/\d+/g)
  if (!nums || nums.length === 0) return 'Dedicate 30–45 minutes'
  if (nums.length >= 2) return `Dedicate ${nums[0]}–${nums[1]} minutes`
  const n = parseInt(nums[0], 10)
  return `Dedicate ${n}–${n + 15} minutes`
}

// Rest guidance by workout type — static coaching copy.
export const REST_GUIDANCE: { label: string; detail: string }[] = [
  { label: 'Warm-ups', detail: 'Rest ~30s — just enough to reset between moves.' },
  { label: 'Strength', detail: 'Rest 2–3 min. Rest long enough to recover so you perform each set with quality.' },
  { label: 'Conditioning', detail: 'Rest ~45s — keep your heart rate up.' },
]
