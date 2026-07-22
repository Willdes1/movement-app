// Shared constants for the Lead Investigation module (Marketing Hub Phase 2).
// Pure data, safe to import from both client UI and server routes.

export type LeadScope = 'local' | 'national' | 'worldwide'
export type LeadType = 'independent' | 'multi_location' | 'enterprise'
export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'archived'

export const LEAD_INDUSTRIES = [
  { id: 'physical-therapy', label: 'Physical therapy clinics', emoji: '🩺' },
  { id: 'personal-training', label: 'Personal training studios', emoji: '🏋️' },
  { id: 'gym', label: 'Commercial gyms', emoji: '💪' },
  { id: 'crossfit', label: 'CrossFit boxes', emoji: '🪢' },
  { id: 'enterprise-chain', label: 'Enterprise chains', emoji: '🏢' },
]

export const industryLabel = (id: string | null | undefined) =>
  LEAD_INDUSTRIES.find(i => i.id === id)?.label ?? 'Business'

// Known large chains — used to flag enterprise leads (long sales cycle for a
// solo founder). Lowercase, matched as substrings against the business name.
export const ENTERPRISE_CHAINS = [
  'la fitness', '24 hour fitness', 'planet fitness', 'equinox', 'crunch fitness',
  'golds gym', "gold's gym", 'anytime fitness', 'orangetheory', 'life time',
  'lifetime fitness', 'ymca', 'f45', 'pure barre', 'club pilates', 'snap fitness',
  'blink fitness', 'ufc gym', 'title boxing', 'athletico', 'select physical therapy',
]

export const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: '#6e7681' },
  { id: 'qualified', label: 'Qualified', color: '#3b82f6' },
  { id: 'contacted', label: 'Contacted', color: '#f59e0b' },
  { id: 'archived', label: 'Archived', color: '#484f58' },
]

export const typeMeta = (t: string | null | undefined) => {
  if (t === 'enterprise') return { label: 'Enterprise', color: '#f59e0b' }
  if (t === 'multi_location') return { label: 'Multi-location', color: '#a78bfa' }
  return { label: 'Independent', color: '#22c55e' }
}
