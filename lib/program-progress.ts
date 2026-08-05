// Where an athlete is in their program.
//
// Home and Calendar used to answer this differently and disagreed the moment a
// program ran out. Home asked "which week am I in" and clamped the answer to 13,
// so it happily replayed week 13 forever. Calendar mapped real dates from the
// start date, so past the end it had nothing at all and rendered a blank page.
// Both now read from here.

export const TOTAL_WEEKS = 13

const DAY_MS = 86_400_000

function startOf(dateStr: string): Date {
  // Midday, so a timezone offset can never shift which day this lands on.
  return new Date(dateStr.split('T')[0] + 'T12:00:00')
}

/** Week number since the program began. Not capped: week 20 returns 20. */
export function elapsedWeek(startDate: string, now: Date = new Date()): number {
  const days = Math.floor((now.getTime() - startOf(startDate).getTime()) / DAY_MS)
  return Math.max(Math.floor(days / 7) + 1, 1)
}

/** Week to display, capped at the program length. Use for labels, not for logic. */
export function currentWeek(startDate: string, totalWeeks = TOTAL_WEEKS, now: Date = new Date()): number {
  return Math.min(elapsedWeek(startDate, now), totalWeeks)
}

/** Last day covered by the program. */
export function programEndDate(startDate: string, totalWeeks = TOTAL_WEEKS): Date {
  const d = startOf(startDate)
  d.setDate(d.getDate() + totalWeeks * 7 - 1)
  return d
}

/**
 * True once the whole program is behind the athlete. Being inside the final
 * week is NOT elapsed: they still have that week to train.
 */
export function isProgramElapsed(startDate: string, totalWeeks = TOTAL_WEEKS, now: Date = new Date()): boolean {
  return now > programEndDate(startDate, totalWeeks)
}

const DAYS_PER_WEEK = 7

/**
 * The week an athlete should come back to: the first one they have not
 * finished. Completions are stored as (week, day) and never as dates, which is
 * what makes resuming a simple shift of start_date rather than a data rewrite.
 *
 * Returns null when every week is done, because there is nothing to resume and
 * they should be offered a new block instead.
 */
export function resumeWeek(
  completions: { week_number: number; day_index: number }[],
  totalWeeks = TOTAL_WEEKS,
): number | null {
  const perWeek = new Map<number, Set<number>>()
  for (const c of completions) {
    if (!perWeek.has(c.week_number)) perWeek.set(c.week_number, new Set())
    perWeek.get(c.week_number)!.add(c.day_index)
  }
  for (let w = 1; w <= totalWeeks; w++) {
    if ((perWeek.get(w)?.size ?? 0) < DAYS_PER_WEEK) return w
  }
  return null
}

/**
 * The start_date that puts `week` on today, so the athlete carries on from
 * where they stopped rather than from a date months in the past. Same trick the
 * coach side already uses for resuming an assignment.
 */
export function startDateForResume(week: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() - (week - 1) * DAYS_PER_WEEK * DAY_MS)
  return localDateKey(d)
}

/** Days since the athlete last completed a day or logged a workout. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
}

/**
 * How far the program has run ahead of the athlete: the week it thinks they are
 * on, minus the week they actually left off at.
 *
 * This, and not "days since you last trained", is what the resume prompt keys
 * on. Days-since never changes when you resume, because resuming moves your
 * dates, not your history, so a prompt gated on it would reappear on every
 * refresh until the athlete trained again. Drift goes to zero the moment the
 * dates are lined up, which is exactly when the prompt should stop asking.
 */
export function weeksAdrift(
  startDate: string,
  completions: { week_number: number; day_index: number }[],
  totalWeeks = TOTAL_WEEKS,
  now: Date = new Date(),
): number {
  const left = resumeWeek(completions, totalWeeks)
  if (left === null) return 0
  return Math.max(elapsedWeek(startDate, now) - left, 0)
}

/** Enough drift to be worth asking about rather than letting it widen silently. */
export const ADRIFT_WEEKS = 2

/**
 * YYYY-MM-DD in the athlete's own timezone.
 *
 * toISOString() is UTC, so west of Greenwich it returns tomorrow's date all
 * evening, and a date-only string fed back into new Date() is read as UTC
 * midnight and lands on the previous day. Both directions produced off-by-one
 * days on the calendar.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a YYYY-MM-DD key at midday local, so no offset can shift the day. */
export function parseDateKey(key: string): Date {
  return new Date(key.split('T')[0] + 'T12:00:00')
}
