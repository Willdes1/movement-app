import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const YT_KEY = process.env.YOUTUBE_API_KEY!

const DISCOVERY_QUERIES = [
  'certified personal trainer exercise tutorial form',
  'strength conditioning coach workout demonstrations',
  'sports performance training exercises technique',
  'physical therapist rehabilitation exercise guide',
  'evidence based fitness training science',
]

type YTChannelRaw = {
  id: string
  snippet?: { title?: string; description?: string }
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string }
}

type ChannelDetail = {
  channelId: string
  channelName: string
  description: string
  subscriberCount: number
  videoCount: number
}

async function searchChannels(query: string): Promise<string[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${encodeURIComponent(query)}&maxResults=8&key=${YT_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.items ?? [])
    .map((i: { id: { channelId: string } }) => i.id.channelId)
    .filter(Boolean)
}

async function getChannelDetails(channelIds: string[]): Promise<ChannelDetail[]> {
  if (!channelIds.length) return []
  const ids = channelIds.join(',')
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids}&key=${YT_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.items ?? [])
    .map((c: YTChannelRaw) => ({
      channelId: c.id,
      channelName: c.snippet?.title ?? '',
      description: (c.snippet?.description ?? '').slice(0, 400),
      subscriberCount: parseInt(c.statistics?.subscriberCount ?? '0', 10),
      videoCount: parseInt(c.statistics?.videoCount ?? '0', 10),
    }))
    .filter((c: ChannelDetail) => c.subscriberCount >= 100_000)
}

async function scoreChannels(channels: ChannelDetail[]): Promise<{
  channelId: string; score: number; audienceFocus: string; reasoning: string
}[]> {
  if (!channels.length) return []

  const list = channels.map((c, i) =>
    `[${i}] "${c.channelName}" — ${(c.subscriberCount / 1000).toFixed(0)}K subs, ${c.videoCount} videos\nDescription: ${c.description}`
  ).join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are selecting YouTube channels for a fitness app that needs clear exercise demonstration videos.

IDEAL channels: certified trainers, S&C coaches, physical therapists, sports scientists. Must have clear exercise form demonstrations, professional production, evidence-based content. Well-established reputation.

REJECT: entertainment/vlog focused, supplement marketers, uncredentialed opinion channels, low video count (<50 videos), primarily motivational content without technique.

Channels to evaluate:
${list}

Return ONLY valid JSON array (no markdown fences):
[{"index": 0, "score": 0.92, "audienceFocus": "strength training, compound lifts", "reasoning": "NSCA-certified trainer, clear technique breakdowns"}]

Score 0.0–1.0. Include only channels with score >= 0.65. Rank by quality and credibility.`
    }]
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try {
    const scored = JSON.parse(cleaned) as { index: number; score: number; audienceFocus: string; reasoning: string }[]
    return scored
      .map(s => ({ ...s, channelId: channels[s.index]?.channelId ?? '' }))
      .filter(s => s.channelId)
  } catch {
    return []
  }
}

export async function POST() {
  try {
    // Run all search queries and collect unique channel IDs
    const seen = new Set<string>()
    for (const query of DISCOVERY_QUERIES) {
      const ids = await searchChannels(query)
      ids.forEach(id => seen.add(id))
    }

    if (seen.size === 0) {
      return Response.json({ error: 'YouTube API returned no channels — check API key' }, { status: 400 })
    }

    // Fetch details for all discovered channels in one batch
    const allIds = [...seen]
    const details = await getChannelDetails(allIds)

    if (details.length === 0) {
      return Response.json({ error: 'No channels met minimum subscriber threshold (100K)' }, { status: 400 })
    }

    // Score with Claude
    const scored = await scoreChannels(details)
    const top = scored.sort((a, b) => b.score - a.score).slice(0, 15)

    if (top.length === 0) {
      return Response.json({ error: 'No channels passed quality scoring — try again' }, { status: 400 })
    }

    // Upsert into approved_yt_channels
    const inserts = top.map((s, i) => {
      const detail = details.find(d => d.channelId === s.channelId)!
      return {
        channel_id:     s.channelId,
        channel_name:   detail.channelName,
        audience_focus: s.audienceFocus,
        priority:       i + 1,
        active:         true,
      }
    })

    await supabaseAdmin
      .from('approved_yt_channels')
      .upsert(inserts, { onConflict: 'channel_id' })

    return Response.json({
      discovered: top.length,
      channels: inserts.map((c, i) => ({ ...c, score: top[i].score, reasoning: top[i].reasoning })),
    })
  } catch (err) {
    console.error('Channel discovery error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Discovery failed' }, { status: 500 })
  }
}
