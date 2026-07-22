import type { LeadScope } from '@/lib/lead-constants'

// Pluggable lead-discovery sources. The rest of the app talks to this interface
// only, so swapping in Google Places or Apollo later is an isolated change: add
// a source object, register it, done. Today only the sample source is wired.

export type LeadSearchParams = { industry: string; location: string; scope: LeadScope; limit: number }

export type RawLead = {
  business_name: string
  category: string
  address: string
  city: string
  region: string
  country: string
  phone: string | null
  website: string | null
  email: string | null
  owner_name: string | null
  rating: number | null
  review_count: number | null
  location_count: number
  source: string
  source_id: string
}

export interface LeadSource {
  id: string
  label: string
  configured: boolean
  search(params: LeadSearchParams): Promise<RawLead[]>
}

// ── sample source ────────────────────────────────────────────────────────────
// Deterministic-enough realistic data so the whole tool can be built and judged
// before committing to a paid data provider.

const NAME_PARTS = ['Summit', 'Iron', 'Peak', 'Anchor', 'Vertex', 'Forge', 'Kinetic', 'Momentum', 'Apex', 'Catalyst', 'Elevate', 'Foundry', 'Pioneer', 'Bedrock', 'Vantage', 'Crestline']
const PT_SUFFIX = ['Physical Therapy', 'Sports Rehab', 'Physical Therapy & Wellness', 'Rehabilitation', 'PT & Performance', 'Movement Clinic']
const PT_STUDIO = ['Personal Training', 'Strength Studio', 'Performance Lab', 'Fitness Coaching', 'Athletic Club', 'Training Co.']
const GYM_SUFFIX = ['Fitness', 'Gym', 'Athletics', 'Strength & Conditioning', 'Health Club', 'Fitness Center']
const CROSSFIT = ['CrossFit', 'Barbell Club', 'Functional Fitness']
const ENTERPRISE = ['LA Fitness', '24 Hour Fitness', 'Planet Fitness', 'Crunch Fitness', 'Anytime Fitness', 'Orangetheory Fitness', 'Equinox']
const FIRST = ['Chris', 'Morgan', 'Dana', 'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Jamie', 'Drew', 'Quinn']
const LAST = ['Nguyen', 'Rivera', 'Okafor', 'Bennett', 'Marsh', 'Delgado', 'Hale', 'Sato', 'Bauer', 'Cruz', 'Flynn', 'Reyes']
const WORLD_CITIES: [string, string, string][] = [
  ['Austin', 'TX', 'USA'], ['Denver', 'CO', 'USA'], ['Portland', 'OR', 'USA'], ['Miami', 'FL', 'USA'],
  ['Toronto', 'ON', 'Canada'], ['London', '', 'UK'], ['Sydney', 'NSW', 'Australia'], ['Austin', 'TX', 'USA'],
  ['Chicago', 'IL', 'USA'], ['Seattle', 'WA', 'USA'], ['Nashville', 'TN', 'USA'], ['Phoenix', 'AZ', 'USA'],
]

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40)

function parseLocation(location: string, scope: LeadScope): [string, string, string] {
  if (scope === 'worldwide' || !location.trim()) return pick(WORLD_CITIES)
  const parts = location.split(',').map(p => p.trim())
  const city = parts[0] || 'Austin'
  const region = parts[1] || ''
  const country = parts[2] || (region ? 'USA' : 'USA')
  return [city, region, country]
}

function makeName(industry: string): { name: string; locations: number; enterprise: boolean } {
  if (industry === 'enterprise-chain') return { name: pick(ENTERPRISE), locations: rint(6, 40), enterprise: true }
  // ~15% of a normal search surfaces a chain location.
  if (Math.random() < 0.15) return { name: pick(ENTERPRISE), locations: rint(6, 40), enterprise: true }
  const base = pick(NAME_PARTS)
  let suffix: string
  if (industry === 'physical-therapy') suffix = pick(PT_SUFFIX)
  else if (industry === 'personal-training') suffix = pick(PT_STUDIO)
  else if (industry === 'crossfit') return { name: `${pick(CROSSFIT)} ${base}`, locations: Math.random() < 0.2 ? 2 : 1, enterprise: false }
  else suffix = pick(GYM_SUFFIX)
  const locations = Math.random() < 0.22 ? rint(2, 4) : 1
  return { name: `${base} ${suffix}`, locations, enterprise: false }
}

export const sampleLeadSource: LeadSource = {
  id: 'sample',
  label: 'Sample data',
  configured: true,
  async search({ industry, location, scope, limit }: LeadSearchParams): Promise<RawLead[]> {
    const [, , ] = parseLocation(location, scope)
    const out: RawLead[] = []
    const seen = new Set<string>()
    let guard = 0
    while (out.length < limit && guard++ < limit * 4) {
      const [city, region, country] = parseLocation(location, scope)
      const { name, locations, enterprise } = makeName(industry)
      const sid = `sample-${slug(name)}-${slug(city)}`
      if (seen.has(sid)) continue
      seen.add(sid)

      const hasSite = Math.random() < 0.82
      const domain = hasSite ? `${slug(name)}.com` : null
      // Sample enrichment: a website often yields a public contact email/owner.
      const hasContact = hasSite && Math.random() < 0.55
      out.push({
        business_name: name,
        category: industry,
        address: `${rint(100, 9800)} ${pick(['Main', 'Oak', 'Congress', 'Lamar', '5th', 'Broadway', 'Market'])} St`,
        city, region, country,
        phone: `(${rint(200, 989)}) 555-${String(rint(1000, 9999))}`,
        website: domain ? `https://${domain}` : null,
        email: hasContact ? `info@${domain}` : null,
        owner_name: hasContact && !enterprise ? `${pick(FIRST)} ${pick(LAST)}` : null,
        rating: Math.round((Math.random() * 1.6 + 3.4) * 10) / 10,
        review_count: enterprise ? rint(300, 2200) : rint(3, 380),
        location_count: locations,
        source: 'sample',
        source_id: sid,
      })
    }
    return out
  },
}

// ── registry ─────────────────────────────────────────────────────────────────
// Real providers register here once wired. Until then they report configured:false
// so the UI can show an honest "connect a data source" state.

export function getLeadSource(id?: string): LeadSource {
  switch (id) {
    // case 'google-places': return googlePlacesSource   // TODO Phase 2b (needs GOOGLE_PLACES_API_KEY)
    // case 'apollo':        return apolloSource          // TODO Phase 2b (needs APOLLO_API_KEY)
    default: return sampleLeadSource
  }
}
