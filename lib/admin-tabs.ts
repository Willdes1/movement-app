// Single source of truth for admin portal sections + which are grantable to
// partner admins vs. private to the owner. Imported by the admin page (nav
// visibility), the Access Control UI (checkbox catalog), and the access API
// (server-side validation so a private tab can never be granted via a crafted
// request).

export type AdminTab = { id: string; label: string; group: string; grantable: boolean }

export const TAB_CATALOG: AdminTab[] = [
  // Analytics — all private (user data + impersonation)
  { id: 'overview',      label: 'Overview',           group: 'Analytics',  grantable: false },
  { id: 'users',         label: 'Users',              group: 'Analytics',  grantable: false },
  { id: 'activity',      label: 'Live Activity',      group: 'Analytics',  grantable: false },
  { id: 'impersonation', label: 'Zoom Log',           group: 'Analytics',  grantable: false },
  { id: 'retention',     label: 'Retention',          group: 'Analytics',  grantable: false },
  // Revenue — all private (money)
  { id: 'stripe',        label: 'Stripe',             group: 'Revenue',    grantable: false },
  { id: 'billing',       label: 'Billing',            group: 'Revenue',    grantable: false },
  { id: 'spend',         label: 'Spend Tracker',      group: 'Revenue',    grantable: false },
  // Operations
  { id: 'bugs',          label: 'Bug Reports',        group: 'Operations', grantable: false },
  { id: 'conversions',   label: 'Conversions',        group: 'Operations', grantable: false },
  { id: 'push',          label: 'Push Notifications', group: 'Operations', grantable: true },
  { id: 'notes',         label: 'Notes',              group: 'Operations', grantable: false },
  { id: 'todos',         label: 'Todos',              group: 'Operations', grantable: false },
  { id: 'ideas',         label: 'Ideas',              group: 'Operations', grantable: false },
  { id: 'promos',        label: 'Promos',             group: 'Operations', grantable: false },
  // Growth
  { id: 'marketing',     label: 'Marketing',          group: 'Growth',     grantable: true },
  { id: 'partners',      label: 'Partners',           group: 'Growth',     grantable: true },
  // Strategy
  { id: 'launchpad',     label: 'Launchpad',          group: 'Strategy',   grantable: true },
  { id: 'ceo',           label: 'CEO Briefing',       group: 'Strategy',   grantable: false },
  { id: 'kb',            label: 'Knowledge Base',     group: 'Strategy',   grantable: true },
  { id: 'study',         label: 'Study Hub',          group: 'Strategy',   grantable: true },
  { id: 'mie',           label: 'APIE',               group: 'Strategy',   grantable: true },
  { id: 'access',        label: 'Access Control',     group: 'Strategy',   grantable: false },
  // Content
  { id: 'media',         label: 'Media Library',      group: 'Content',    grantable: true },
  { id: 'video',         label: 'Video Curation',     group: 'Content',    grantable: true },
  { id: 'tts',           label: 'TTS Audio',          group: 'Content',    grantable: true },
  // Dev Tools — private (cost/infra data)
  { id: 'health',        label: 'Health Monitor',     group: 'Dev Tools',  grantable: false },
]

export const GRANTABLE_TABS = TAB_CATALOG.filter(t => t.grantable).map(t => t.id)
export const PRIVATE_TABS = TAB_CATALOG.filter(t => !t.grantable).map(t => t.id)
export const TAB_LABEL: Record<string, string> = Object.fromEntries(TAB_CATALOG.map(t => [t.id, t.label]))

/** Keep only ids that are actually grantable (drops private/unknown ids). */
export function sanitizeTabs(tabs: unknown): string[] {
  if (!Array.isArray(tabs)) return []
  return tabs.filter((t): t is string => typeof t === 'string' && GRANTABLE_TABS.includes(t))
}
