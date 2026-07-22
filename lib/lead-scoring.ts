import { ENTERPRISE_CHAINS, type LeadType } from '@/lib/lead-constants'

// Pure classification + scoring. No external calls, so it runs anywhere and
// costs nothing. Tuned for Atlas Prime's target buyer: independent studios and
// small clinics where you can reach the owner and they actually need software.

export type LeadSignals = {
  business_name: string
  website?: string | null
  phone?: string | null
  email?: string | null
  rating?: number | null
  review_count?: number | null
  location_count?: number | null
}

export function classifyBusiness(lead: LeadSignals): LeadType {
  const name = (lead.business_name ?? '').toLowerCase()
  if (ENTERPRISE_CHAINS.some(c => name.includes(c))) return 'enterprise'
  const locs = lead.location_count ?? 1
  if (locs >= 5) return 'enterprise'
  if (locs >= 2) return 'multi_location'
  return 'independent'
}

export function scoreLead(lead: LeadSignals, type: LeadType): { score: number; reasons: string[] } {
  let score = 50
  const reasons: string[] = []

  // Fit: independents and small chains are the sweet spot for coach software.
  if (type === 'independent') { score += 20; reasons.push('Independent — a direct line to the owner') }
  else if (type === 'multi_location') { score += 12; reasons.push('Small chain (2+ locations) with room to grow') }
  else { score -= 15; reasons.push('Enterprise chain — long sales cycle') }

  if (lead.website) { score += 8; reasons.push('Has a website') } else { score -= 6; reasons.push('No website found') }
  if (lead.phone) score += 4
  if (lead.email) { score += 10; reasons.push('Contact email available') }

  const rc = lead.review_count ?? 0
  if (rc >= 20 && rc <= 300) { score += 8; reasons.push('Established but still personal') }
  else if (rc > 300) { score -= 4; reasons.push('Very large footprint') }
  else if (rc > 0 && rc < 20) reasons.push('Newer or quiet online presence')

  if ((lead.rating ?? 0) >= 4.3) { score += 4; reasons.push('Well rated') }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons }
}
