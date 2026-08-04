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
