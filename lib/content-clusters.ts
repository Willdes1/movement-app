// Topic clusters for the content engine. Shared by the admin generator UI and
// the server generate route, so it must stay free of any server-only imports.

export type ContentCluster = {
  id: string
  label: string
  emoji: string
  audience: string
  terms: string
  angle: string
}

export const CONTENT_CLUSTERS: ContentCluster[] = [
  {
    id: 'coach-software',
    label: 'Coach software',
    emoji: '🧑‍🏫',
    audience: 'personal trainers and coaches evaluating tools to run and grow their practice',
    terms: 'coaching software, online coaching, manage clients, program builder, client retention, remote coaching',
    angle: 'Help a coach do their job better. Position Atlas Prime honestly, only where it genuinely fits.',
  },
  {
    id: 'recovery-rehab',
    label: 'Recovery & rehab',
    emoji: '🩹',
    audience: 'athletes and active people dealing with pain, tightness, injury, or recovery',
    terms: 'injury recovery, rehab exercises, mobility, pain relief, return to sport, prehab',
    angle: 'Safe, practical guidance. Never diagnose. Tell readers to see a professional for red-flag symptoms.',
  },
  {
    id: 'ai-training',
    label: 'AI training',
    emoji: '🤖',
    audience: 'athletes and lifters curious whether an AI-built training plan is any good',
    terms: 'AI workout plan, personalized training program, periodization, progressive overload, strength program',
    angle: 'Explain how good AI programming actually works, where it helps, and where a human still matters.',
  },
  {
    id: 'sport-specific',
    label: 'Sport-specific',
    emoji: '🏂',
    audience: 'athletes in a specific sport who want training that carries over to their sport',
    terms: 'sport-specific training, strength and conditioning, movement demands, athletic performance',
    angle: 'Concrete, sport-aware programming guidance a coach for that sport would nod along to.',
  },
]

export const clusterLabel = (id: string | null | undefined): string =>
  CONTENT_CLUSTERS.find(c => c.id === id)?.label ?? 'Article'
