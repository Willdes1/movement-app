import { verifyAdmin } from '@/lib/admin-auth'
import { getLeadSource } from '@/lib/lead-sources'
import { classifyBusiness, scoreLead } from '@/lib/lead-scoring'
import { industryLabel } from '@/lib/lead-constants'

export const runtime = 'nodejs'
export const maxDuration = 60

// Run a lead search, classify + score each result, and store new ones.
export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const b = await req.json().catch(() => ({}))
    const industry = String(b.industry ?? 'gym')
    const location = String(b.location ?? '').trim()
    const scope = ['local', 'national', 'worldwide'].includes(b.scope) ? b.scope : 'local'
    const limit = Math.max(1, Math.min(40, Number(b.limit) || 20))

    const source = getLeadSource(b.source)
    const raws = await source.search({ industry, location, scope, limit })

    const where = location || (scope === 'worldwide' ? 'worldwide' : 'nearby')
    const searchLabel = `${industryLabel(industry)} · ${where}`

    const rows = raws.map(r => {
      const type = classifyBusiness(r)
      const { score, reasons } = scoreLead(r, type)
      return {
        business_name: r.business_name, category: r.category, business_type: type,
        lead_score: score, score_reasons: reasons,
        address: r.address, city: r.city, region: r.region, country: r.country,
        phone: r.phone, website: r.website, email: r.email, owner_name: r.owner_name,
        rating: r.rating, review_count: r.review_count, location_count: r.location_count,
        source: r.source, source_id: r.source_id, status: 'new', search_label: searchLabel,
        updated_at: new Date().toISOString(),
      }
    })

    // Ignore duplicates (same source + source_id) so repeat searches don't pile up.
    const { data, error } = await auth.supabase
      .from('leads')
      .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: true })
      .select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({
      found: rows.length,
      inserted: data?.length ?? 0,
      source: source.id,
      configured: source.configured,
    })
  } catch (err) {
    console.error('lead search error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 })
  }
}
