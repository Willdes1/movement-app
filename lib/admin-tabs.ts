// Single source of truth for admin portal sections + how shareable each one is.
//
// The owner may grant ANY section to a partner at their discretion. Sections are
// flagged `sensitive` (user data / money / platform controls) so the UI can warn
// before sharing — but they are NOT hard-locked. The only true owner-only section
// is Access Control itself (the master key that manages everyone's permissions);
// a partner must never be able to grant themselves more.
//
// Imported by the admin page (nav visibility), the Access Control UI (the
// checkbox catalog + warnings), and the access API (server-side validation).

export type AdminTab = { id: string; label: string; group: string; sensitive: boolean }

export const TAB_CATALOG: AdminTab[] = [
  // Analytics — sensitive (user data + impersonation)
  { id: 'overview',      label: 'Overview',           group: 'Analytics',  sensitive: true },
  { id: 'users',         label: 'Users',              group: 'Analytics',  sensitive: true },
  { id: 'activity',      label: 'Live Activity',      group: 'Analytics',  sensitive: true },
  { id: 'impersonation', label: 'Zoom Log',           group: 'Analytics',  sensitive: true },
  { id: 'retention',     label: 'Retention',          group: 'Analytics',  sensitive: true },
  // Revenue — sensitive (money)
  { id: 'stripe',        label: 'Stripe',             group: 'Revenue',    sensitive: true },
  { id: 'billing',       label: 'Billing',            group: 'Revenue',    sensitive: true },
  { id: 'spend',         label: 'Spend Tracker',      group: 'Revenue',    sensitive: true },
  // Operations
  { id: 'bugs',          label: 'Bug Reports',        group: 'Operations', sensitive: true },
  { id: 'conversions',   label: 'Conversions',        group: 'Operations', sensitive: true },
  { id: 'push',          label: 'Push Notifications', group: 'Operations', sensitive: false },
  { id: 'notes',         label: 'Notes',              group: 'Operations', sensitive: true },
  { id: 'todos',         label: 'Todos',              group: 'Operations', sensitive: false },
  { id: 'ideas',         label: 'Ideas',              group: 'Operations', sensitive: false },
  { id: 'promos',        label: 'Promos',             group: 'Operations', sensitive: true },
  // Growth
  { id: 'marketing',     label: 'Marketing',          group: 'Growth',     sensitive: false },
  { id: 'partners',      label: 'Partners',           group: 'Growth',     sensitive: false },
  // Strategy
  { id: 'launchpad',     label: 'Launchpad',          group: 'Strategy',   sensitive: false },
  { id: 'ceo',           label: 'CEO Briefing',       group: 'Strategy',   sensitive: true },
  { id: 'kb',            label: 'Knowledge Base',     group: 'Strategy',   sensitive: false },
  { id: 'study',         label: 'Study Hub',          group: 'Strategy',   sensitive: false },
  { id: 'mie',           label: 'APIE',               group: 'Strategy',   sensitive: false },
  { id: 'access',        label: 'Access Control',     group: 'Strategy',   sensitive: true },
  // Content
  { id: 'media',         label: 'Media Library',      group: 'Content',    sensitive: false },
  { id: 'video',         label: 'Video Curation',     group: 'Content',    sensitive: false },
  { id: 'tts',           label: 'TTS Audio',          group: 'Content',    sensitive: false },
  { id: 'seed',          label: 'Library Builder',    group: 'Content',    sensitive: false },
  // Dev Tools — sensitive (cost/infra data)
  { id: 'health',        label: 'Health Monitor',     group: 'Dev Tools',  sensitive: true },
  { id: 'architecture',  label: 'Architecture',       group: 'Dev Tools',  sensitive: false },
]

// The master key — manages everyone's permissions. Owner-only, never grantable.
export const OWNER_ONLY_TABS = ['access']

export const GRANTABLE_TABS = TAB_CATALOG.filter(t => !OWNER_ONLY_TABS.includes(t.id)).map(t => t.id)
export const SENSITIVE_TABS = TAB_CATALOG.filter(t => t.sensitive).map(t => t.id)
export const TAB_LABEL: Record<string, string> = Object.fromEntries(TAB_CATALOG.map(t => [t.id, t.label]))

export const isSensitive = (id: string) => SENSITIVE_TABS.includes(id)

/** Keep only ids that may be granted (drops the owner-only master key + unknowns). */
export function sanitizeTabs(tabs: unknown): string[] {
  if (!Array.isArray(tabs)) return []
  return tabs.filter((t): t is string => typeof t === 'string' && GRANTABLE_TABS.includes(t))
}
