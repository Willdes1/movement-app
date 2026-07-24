// Shared constants for the AI Ads Studio (Marketing Hub Phase 4). Pure data,
// safe to import from both client UI and server routes.

export const AD_PLATFORMS = [
  { id: 'google', label: 'Google Search', emoji: '🔍', kind: 'search' },
  { id: 'meta', label: 'Facebook / Meta', emoji: '📘', kind: 'social' },
  { id: 'instagram', label: 'Instagram', emoji: '📸', kind: 'social' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', kind: 'social' },
] as const

export const AD_PRODUCTS = [
  { id: 'athlete', label: 'Athlete app', audience: 'athletes and active people who want a personalized AI training plan for their sport' },
  { id: 'coach', label: 'Coach product', audience: 'personal trainers, coaches, and gym or clinic owners who program for clients' },
] as const

export const AD_OBJECTIVES = [
  { id: 'signups', label: 'Signups / conversions' },
  { id: 'traffic', label: 'Traffic to the site' },
  { id: 'awareness', label: 'Awareness / reach' },
  { id: 'installs', label: 'App installs' },
] as const

export const platformMeta = (id: string) => AD_PLATFORMS.find(p => p.id === id) ?? AD_PLATFORMS[0]
export const productLabel = (id: string) => AD_PRODUCTS.find(p => p.id === id)?.label ?? id
export const objectiveLabel = (id: string) => AD_OBJECTIVES.find(o => o.id === id)?.label ?? id
