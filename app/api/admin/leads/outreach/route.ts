import Anthropic from '@anthropic-ai/sdk'
import { verifyAdmin } from '@/lib/admin-auth'
import { logTokens } from '@/lib/log-tokens'
import { industryLabel, typeMeta } from '@/lib/lead-constants'

export const runtime = 'nodejs'
export const maxDuration = 60

let _client: Anthropic | null = null
const client = () => (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))

const TONES: Record<string, string> = {
  warm: 'Warm and human. A peer reaching out, curious about their business, low pressure.',
  direct: 'Direct and results-focused. Lead with the concrete benefit and a clear ask. Respect their time.',
  problem: 'Problem-first. Open with a pain point coaches feel (time spent programming, keeping clients accountable), then the fix.',
}

const SYSTEM = `You write cold outreach for Atlas Prime, an AI performance training platform. For coaches and gym/clinic owners, Atlas Prime is a full portal: build client programs with AI or by hand, manage clients, message them, track who is actually training, and deliver coaching cues in the coach's own voice. It saves programming time and helps a coach run more clients without dropping quality.

You are writing to the OWNER or head coach of a fitness business, to start a conversation (not to hard-close). Sending is manual, so make each piece ready to copy and send as-is.

RULES:
- Sound like a real person, not a marketing bot. Warm, specific, confident.
- NEVER use em dashes. Use periods, commas, or parentheses. Hard rule.
- Lead with a benefit to THEM, never a feature dump. One clear, low-friction ask (a quick reply, a 10-minute call, or a free trial).
- Personalize to the business by name and city, but do NOT invent facts about them or fake compliments. Reference their business type honestly.
- Be honest and concise. No hype, no fake urgency, no made-up stats.
- Keep it human length: email 80 to 130 words, DM 40 to 70 words, SMS under 300 characters, call script a short opener plus 3 to 4 bullet talking points and one closing ask.

Return ONLY valid JSON, no code fence, this exact shape:
{
  "email_subject": "short, specific, not clickbait",
  "email_body": "the email, plain text with line breaks as \\n. No double quotes inside; use single quotes.",
  "dm_message": "a short social DM",
  "sms_message": "a short SMS",
  "call_script": "opener line, then talking points as - bullets, then the ask. Use \\n line breaks."
}`

function parse(text: string): Record<string, string> {
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const grab = (k: string) => {
    const m = new RegExp(`"${k}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"[a-z_]+"\\s*:|}\\s*$)`).exec(cleaned)
    return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''
  }
  return {
    email_subject: grab('email_subject'), email_body: grab('email_body'),
    dm_message: grab('dm_message'), sms_message: grab('sms_message'), call_script: grab('call_script'),
  }
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const leadId = new URL(req.url).searchParams.get('leadId')
  if (!leadId) return Response.json({ error: 'leadId required' }, { status: 400 })
  const { data } = await auth.supabase.from('lead_outreach').select('*').eq('lead_id', leadId).maybeSingle()
  return Response.json({ outreach: data ?? null })
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const b = await req.json().catch(() => ({}))
    const leadId = String(b.leadId ?? '')
    if (!leadId) return Response.json({ error: 'leadId required' }, { status: 400 })
    const tone = TONES[b.tone] ? b.tone : 'warm'

    const { data: lead } = await auth.supabase.from('leads').select('*').eq('id', leadId).maybeSingle()
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 })

    const where = [lead.city, lead.region].filter(Boolean).join(', ') || lead.country || 'their area'
    const userMsg = `Write an outreach kit for this business.

BUSINESS: ${lead.business_name}
TYPE: ${typeMeta(lead.business_type).label} ${industryLabel(lead.category)}
LOCATION: ${where}
${lead.owner_name ? `OWNER / CONTACT: ${lead.owner_name}` : 'OWNER: unknown, address the business or "there"'}
TONE: ${TONES[tone]}

Return ONLY the JSON object.`

    const message = await client().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const k = parse(raw)

    const now = new Date().toISOString()
    const row = {
      lead_id: leadId,
      email_subject: k.email_subject ?? '', email_body: k.email_body ?? '',
      dm_message: k.dm_message ?? '', sms_message: k.sms_message ?? '', call_script: k.call_script ?? '',
      tone, updated_at: now,
    }
    const { data, error } = await auth.supabase.from('lead_outreach').upsert(row).select().maybeSingle()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    logTokens({
      operation: 'lead_outreach', route: '/api/admin/leads/outreach',
      input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens, user_id: auth.userId,
    })
    return Response.json({ outreach: data })
  } catch (err) {
    console.error('outreach error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
