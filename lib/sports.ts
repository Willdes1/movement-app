// The single sport/activity list offered at signup.
//
// Used by the athlete questionnaire (components/OnboardingModal.tsx) and by the
// coach self-training step (components/coach/OnboardingOverlay.tsx). Both write
// into profiles.sport, so they have to offer the same vocabulary: if a coach
// picks "Snowboarding / Skiing" and an athlete picks "Snowboarding", the plan
// generator and the sport-specialist agent are matching against two different
// strings for one sport.
//
// Stored as a ", "-joined string in profiles.sport. /profile parses it back with
// a split on ", ", and app/api/generate-plan prints it as "Primary sport(s)".
// Keep "Other" last: both callers treat it as the free-text escape hatch.

export const SPORTS = [
  'Gym / Weight Training', 'Running', 'Cycling', 'Swimming',
  'Basketball', 'Soccer / Football', 'Tennis / Pickleball', 'Golf',
  'Skateboarding', 'Snowboarding / Skiing', 'Surfing',
  'Martial Arts / Combat Sports', 'Yoga / Pilates',
  'CrossFit / HIIT', 'Hiking / Trail', 'Other',
] as const

/** Join selected sports into the shape profiles.sport expects. */
export function joinSports(selected: string[], customSport = ''): string {
  return [
    ...selected.filter(s => s !== 'Other'),
    ...(selected.includes('Other') && customSport.trim() ? [customSport.trim()] : []),
  ].join(', ')
}
