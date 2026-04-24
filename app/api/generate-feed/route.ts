import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a dual-layer elite performance coach generating a personalized content feed for an athlete.

Generate exactly 6 cards — a mix of sport-specific performance tips and Japanese warrior mindset cards. Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.

SPORT TIP CARDS (type: "tip"):
- sport: which sport this tip targets
- title: a specific technique or skill focus — never generic (e.g. "Locking Your Front Foot on Back 50-50s" not "Skateboarding Tips")
- body: 4-5 sentences of expert, specific, technical coaching. Like a world-class coach explaining it in full. Real technique cues, real depth, real value.
- cue: one short action cue the athlete can use in the moment (e.g. "Pop at 90 degrees, even pressure through both hips")

MINDSET CARDS (type: "mindset"):
- principle: one of: "Mushin" | "Kaizen" | "Shokunin" | "Zanshin" | "Fudoshin"
- title: a specific application of this principle to the athlete's sport or goal — not abstract
- body: 4-5 sentences. Grounded, practical, sport-specific. Apply the principle directly — no vague philosophy.
- cue: one short mental cue for before or during performance

JAPANESE WARRIOR PRINCIPLES:
- Mushin: action without overthinking — automatic execution, no fear-freeze, full commitment
- Kaizen: small daily improvements compounding — 1% better every session beats intensity spikes
- Shokunin: master the process, not the result — fall in love with the rep, the drill, the detail
- Zanshin: relaxed sustained awareness — fully present before, during, and after every action
- Fudoshin: immovable mind under pressure — emotionally steady after mistakes, criticism, or failure

Mix tip and mindset cards. If the user has multiple sports, cover each. Use varied principles across mindset cards.

Each card JSON shape:
{ "type": "tip" | "mindset", "sport": "...", "principle": "...", "title": "...", "body": "...", "cue": "..." }
Omit "sport" on mindset cards. Omit "principle" on tip cards.
Return nothing but the raw JSON array of exactly 6 cards.`

export async function POST(request: Request) {
  try {
    const { profile } = await request.json()

    const lines: string[] = ['ATHLETE PROFILE:']
    if (profile.name) lines.push(`Name: ${profile.name}`)
    if (profile.gender) lines.push(`Gender: ${profile.gender}`)
    if (profile.sport) lines.push(`Sport(s): ${profile.sport}`)
    if (profile.goal) lines.push(`Goal(s): ${profile.goal}`)
    if (profile.goal_notes) lines.push(`Goal description: ${profile.goal_notes}`)
    if (profile.prior_programs) lines.push(`Training background: ${profile.prior_programs}`)
    lines.push('\nGenerate the 6-card personalized feed now.')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: lines.join('\n') }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const cards = JSON.parse(cleaned)

    if (!Array.isArray(cards)) throw new Error('Expected array')

    return Response.json({ cards })
  } catch (err) {
    console.error('Feed generation error:', err)
    return Response.json({ error: 'Failed to generate feed' }, { status: 500 })
  }
}
