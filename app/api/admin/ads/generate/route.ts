import Anthropic from '@anthropic-ai/sdk'
import { verifyAdmin } from '@/lib/admin-auth'
import { logTokens } from '@/lib/log-tokens'
import { AD_PLATFORMS, AD_PRODUCTS, AD_OBJECTIVES } from '@/lib/ads-constants'

export const runtime = 'nodejs'
export const maxDuration = 60

let _client: Anthropic | null = null
const client = () => (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))

const PLATFORM_GUIDE: Record<string, string> = {
  google: 'Google Search (Responsive Search Ads). Provide search KEYWORDS the buyer would type (mix of match types, note them). Headlines must be <= 30 characters each (give at least 6). Descriptions <= 90 characters (give at least 3). Audience is intent-based, so keywords matter most; interests matter less.',
  meta: 'Facebook / Meta feed ads. No keywords. Focus on detailed interest + behavior + demographic targeting and lookalike ideas. Primary text can be longer (1 to 3 short paragraphs). Give a punchy headline and a description. Suggest a strong thumb-stopping visual concept.',
  instagram: 'Instagram feed + reels ads. Visual-first. No keywords. Interest + lookalike targeting. Short primary text, strong hook in the first line. Creative concepts should be reel/story friendly (fast, visual, authentic).',
  tiktok: 'TikTok ads. Native, fast, authentic (not polished corporate). No keywords. Interest + behavior targeting. Creative ideas are the priority: give 3 to 5 concrete video hook concepts (first 2 seconds) that feel organic to TikTok. Copy is short and casual.',
}

const SYSTEM = `You are a senior performance-marketing strategist for Atlas Prime, an AI performance training platform. The athlete app gives people a personalized AI training plan for their sport with video demos, spoken cues, and tracking. The coach product is a full portal to build client programs with AI, manage clients, message them, and deliver cues in the coach's own voice.

You produce a complete, ready-to-launch paid-ads campaign that a founder can paste straight into the platform's ads manager. Be specific and practical, never generic.

RULES:
- NEVER use em dashes. Use periods, commas, or parentheses. Hard rule.
- Every headline and line of copy leads with a benefit to the user, never a feature dump.
- Respect the platform's formats and character limits exactly (see the platform guide).
- Be honest. No fake stats, no unrealistic promises, no made-up testimonials.
- Tailor targeting and creative to the specific product audience given.

Return ONLY valid JSON, no code fence, this exact shape:
{
  "campaign_name": "short descriptive name",
  "big_idea": "the one-sentence angle for this campaign",
  "audience": { "who": "one line", "demographics": "age/gender/etc", "interests": ["..."], "locations": "suggestion", "lookalikes": "lookalike/custom-audience idea" },
  "keywords": ["keyword ideas for search platforms; empty array [] for social"],
  "ad_variations": [ { "headlines": ["..."], "primary_text": "...", "description": "...", "cta": "e.g. Sign Up" } ],
  "creative_ideas": ["concrete visual or video hook concepts"],
  "budget_bid": "how to split the daily budget and which bidding strategy to start with",
  "setup_notes": "2 to 4 practical tips to launch this in the platform's ads manager"
}
Give at least 2 ad_variations. In body fields, do not use double-quote characters; use single quotes.`

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const b = await req.json().catch(() => ({}))
    const platform = AD_PLATFORMS.find(p => p.id === b.platform) ?? AD_PLATFORMS[0]
    const product = AD_PRODUCTS.find(p => p.id === b.product) ?? AD_PRODUCTS[0]
    const objective = AD_OBJECTIVES.find(o => o.id === b.objective) ?? AD_OBJECTIVES[0]
    const dailyBudget = Number.isFinite(b.dailyBudget) ? Math.max(0, b.dailyBudget) : null
    const notes = String(b.notes ?? '').trim()

    const userMsg = `Create a paid-ads campaign.

PLATFORM: ${platform.label}
PLATFORM GUIDE: ${PLATFORM_GUIDE[platform.id]}
PRODUCT: ${product.label} (audience: ${product.audience})
OBJECTIVE: ${objective.label}
DAILY BUDGET: ${dailyBudget != null ? `$${dailyBudget}` : 'not specified, suggest a sensible starting budget'}
${notes ? `EXTRA DIRECTION: ${notes}` : ''}

Return ONLY the JSON object.`

    const message = await client().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let plan: Record<string, unknown>
    try { plan = JSON.parse(cleaned) } catch {
      return Response.json({ error: 'The plan came back malformed. Please generate again.' }, { status: 502 })
    }

    const now = new Date().toISOString()
    const row = {
      name: String(plan.campaign_name ?? `${platform.label} · ${product.label}`),
      platform: platform.id, product: product.id, objective: objective.id,
      daily_budget: dailyBudget, plan, status: 'draft', updated_at: now,
    }
    const { data, error } = await auth.supabase.from('ad_campaigns').insert(row).select().maybeSingle()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    logTokens({
      operation: 'ad_campaign', route: '/api/admin/ads/generate',
      input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens, user_id: auth.userId,
    })
    return Response.json({ campaign: data })
  } catch (err) {
    console.error('ads generate error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
