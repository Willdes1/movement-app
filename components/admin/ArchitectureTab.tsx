'use client'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

// System architecture reference, rendered natively in the Admin Portal.
// Mirrors ARCHITECTURE.md + docs/architecture.html — keep the three in sync
// when the backend changes. Dark "console/blueprint" palette, provider-coded
// (Claude = purple, OpenAI = green) to match the Spend Tracker.

const C = {
  bg: '#0b0f16', surface: '#121a24', surface2: '#18222f', border: '#26313f', borderSoft: '#1d2732',
  text: '#e7edf5', textMid: '#b3bece', textDim: '#808fa3',
  accent: '#3b82f6', claude: '#a78bfa', openai: '#34d399', data: '#22d3ee', money: '#f5a623',
}
const MONO = "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace"
const TONE: Record<string, string> = { accent: C.accent, claude: C.claude, openai: C.openai, data: C.data, money: C.money, plain: C.border }

type Tone = 'accent' | 'claude' | 'openai' | 'data' | 'money' | 'plain'
type NodeT = { tone?: Tone; label: string; desc: string; tag?: string; tagTone?: Tone }

// ── primitives ──────────────────────────────────────────────────────────────
function FlowNode({ tone = 'accent', label, desc, tag, tagTone }: NodeT) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${TONE[tone]}`,
      borderRadius: 10, padding: '12px 15px', minWidth: 160, flex: '0 0 auto',
    }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: C.text, display: 'block', letterSpacing: '0.02em' }}>{label}</span>
      <span style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.4, display: 'block', marginTop: 4 }}>{desc}</span>
      {tag && <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 7, display: 'inline-block', color: TONE[tagTone ?? tone] }}>{tag}</span>}
    </div>
  )
}

function Arrow() {
  return <span aria-hidden style={{ flex: '0 0 auto', alignSelf: 'center', color: C.textDim, fontFamily: MONO, fontSize: 16, padding: '0 10px' }}>→</span>
}

function Flow({ nodes }: { nodes: NodeT[] }) {
  return (
    <div style={{ overflowX: 'auto', padding: '4px 2px 12px', margin: '8px 0 6px' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 'min-content' }}>
        {nodes.map((n, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <FlowNode {...n} />
            {i < nodes.length - 1 && <Arrow />}
          </div>
        ))}
      </div>
    </div>
  )
}

function Section({ n, kicker, title, children }: { n: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section style={{ paddingTop: 26, marginTop: 26, borderTop: `1px solid ${C.borderSoft}` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textDim }}>{n} — {kicker}</div>
      <h3 style={{ fontSize: 21, fontWeight: 750, letterSpacing: '-0.015em', margin: '7px 0 12px', color: C.text }}>{title}</h3>
      {children}
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 14px', maxWidth: '70ch', color: C.textMid, fontSize: 14.5, lineHeight: 1.65 }}>{children}</p>
}

function Mono({ children }: { children: ReactNode }) {
  return <code style={{ fontFamily: MONO, fontSize: '0.86em', background: C.surface2, border: `1px solid ${C.borderSoft}`, padding: '1px 6px', borderRadius: 5, color: C.text, whiteSpace: 'nowrap' }}>{children}</code>
}

function Note({ tone = 'accent', label, children }: { tone?: Tone; label: string; children: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${TONE[tone]}`, background: C.surface, borderRadius: 10, padding: '13px 16px', margin: '16px 0', maxWidth: '76ch' }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0 6px', border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520, fontSize: 13.5 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '10px 15px', fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, background: C.surface2, fontWeight: 600, borderBottom: `1px solid ${C.borderSoft}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} style={{ padding: '10px 15px', borderBottom: ri < rows.length - 1 ? `1px solid ${C.borderSoft}` : 'none', color: C.textMid, verticalAlign: 'top', lineHeight: 1.5 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function K({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span style={{ fontFamily: MONO, fontSize: 12.5, color: tone ? TONE[tone] : C.text, whiteSpace: 'nowrap' }}>{children}</span>
}
function Dim({ children }: { children: ReactNode }) {
  return <span style={{ color: C.textDim }}>{children}</span>
}

function DomainCard({ dot, title, desc, items }: { dot: string; title: string; desc: string; items: string[] }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface, padding: '15px 16px' }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8, color: C.text }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flex: '0 0 auto' }} />{title}
      </h4>
      <p style={{ fontSize: 12.5, color: C.textDim, margin: '0 0 10px' }}>{desc}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(it => (
          <li key={it} style={{ fontFamily: MONO, fontSize: 11, color: C.textMid, background: C.surface2, border: `1px solid ${C.borderSoft}`, padding: '3px 8px', borderRadius: 6 }}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

const pillBase: CSSProperties = { fontFamily: MONO, fontSize: 11.5, padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.border}`, background: C.surface2, color: C.textMid, whiteSpace: 'nowrap' }

function Layer({ name, items }: { name: ReactNode; items: { label: string; tone?: Tone }[] }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface, padding: '13px 16px', display: 'grid', gridTemplateColumns: '132px 1fr', gap: 16, alignItems: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, lineHeight: 1.35 }}>{name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {items.map((it, i) => (
          <span key={i} style={{ ...pillBase, ...(it.tone ? { borderColor: TONE[it.tone] + '66', color: '#dfe8f5' } : {}) }}>{it.label}</span>
        ))}
      </div>
    </div>
  )
}

// Harness self-test — proves read-after-write verification fails loud, not silent.
// (Moves to the dedicated Telemetry tab in Stage 2.)
function SelfTest() {
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/harness-selftest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      })
      const d = await res.json()
      if (d.ok && d.threwAsExpected) setResult('✓ Safety net works — the broken write threw loudly. Check the server logs for [VERIFY_FAIL].')
      else setResult('✗ ' + (d.note || d.error || 'Unexpected — verification may not be firing.'))
    } catch { setResult('✗ Could not run the self-test.') }
    setBusy(false)
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, background: C.surface, borderRadius: 10, padding: '13px 16px', margin: '16px 0', maxWidth: '76ch' }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>Harness · read-after-write verification</div>
      <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 10 }}>
        Money + critical-state writes now confirm they persisted. Run the self-test — it fires a deliberately broken write and proves it fails <strong style={{ color: '#fff' }}>loud</strong>, not silent (writes nothing; Postgres rejects it).
      </div>
      <button onClick={run} disabled={busy} style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Running…' : '🔧 Run harness self-test'}
      </button>
      {result && <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.5, color: result.startsWith('✓') ? C.openai : C.money }}>{result}</div>}
    </div>
  )
}

// ── the tab ─────────────────────────────────────────────────────────────────
export default function ArchitectureTab() {
  return (
    <div style={{ maxWidth: 980, color: C.text }}>
      {/* Masthead */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.accent, fontWeight: 600 }}>Backend Reference</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 8px', color: C.text }}>System Architecture &amp; Data Flow</h2>
        <P>
          How Atlas Prime is wired end to end — from a tap in the app, through the API layer and database,
          out to the AI services, and back. One codebase serves three surfaces: the <strong style={{ color: '#fff' }}>Athlete app</strong>,
          the <strong style={{ color: '#fff' }}>Coach Portal</strong>, and the <strong style={{ color: '#fff' }}>Admin Portal</strong>.
        </P>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        {[['52', 'API routes'], ['1', 'Postgres DB'], ['~40', 'Tables'], ['4', 'AI / pay providers'], ['3', 'App surfaces'], ['5', 'User roles']].map(([b, s]) => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', padding: '10px 15px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, minWidth: 112 }}>
            <b style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{b}</b>
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginTop: 2 }}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: C.textDim, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
        Next.js 16 + Supabase + Vercel · production: atlasprime.app · mirrors ARCHITECTURE.md
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '18px 0 2px', fontFamily: MONO, fontSize: 12 }}>
        {[['Atlas / core', C.accent], ['Claude', C.claude], ['OpenAI', C.openai], ['Data / Postgres', C.data], ['Money / external', C.money]].map(([label, col]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.textMid }}>
            <i style={{ width: 11, height: 11, borderRadius: 3, background: col, display: 'inline-block' }} />{label}
          </span>
        ))}
      </div>

      <Section n="01" kicker="Layers" title="The stack, top to bottom">
        <P>Four layers. A request falls straight down through them and the response climbs back up.</P>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0 4px' }}>
          <Layer name={<>Client<br />Browser / PWA</>} items={[{ label: 'React 19', tone: 'accent' }, { label: 'Next.js App Router' }, { label: 'Inline-styled components' }, { label: 'Installable PWA' }, { label: 'Web Push' }]} />
          <Layer name={<>Edge<br />API Routes</>} items={[{ label: 'Vercel serverless', tone: 'accent' }, { label: 'Node runtime' }, { label: '60s max / call' }, { label: 'JWT verification' }, { label: 'Batch chunking' }]} />
          <Layer name={<>Data<br />Supabase</>} items={[{ label: 'Postgres + RLS', tone: 'data' }, { label: 'Auth (email · Google · Apple)', tone: 'data' }, { label: 'Storage', tone: 'data' }, { label: 'Realtime', tone: 'data' }, { label: 'pgvector (RAG)', tone: 'data' }]} />
          <Layer name={<>Providers<br />AI &amp; Pay</>} items={[{ label: 'Anthropic · Claude', tone: 'claude' }, { label: 'OpenAI · TTS / Embed / Whisper', tone: 'openai' }, { label: 'ElevenLabs · voice clone' }, { label: 'Stripe · RevenueCat', tone: 'money' }, { label: 'YouTube Data API' }]} />
        </div>
        <Note tone="money" label="Hard constraint">
          Vercel Hobby kills any function at <strong style={{ color: '#fff' }}>60 seconds</strong>. Every bulk job (voicing,
          library fill, video curation) is chunked into small parallel batches and looped from the client — never one long server call.
        </Note>
      </Section>

      <Section n="02" kicker="The core pattern" title="How one request actually flows">
        <P>The single most important backend pattern. Every coach and admin route follows it. There are <strong style={{ color: '#fff' }}>two</strong> database connections, for two different jobs:</P>
        <Flow nodes={[
          { tone: 'plain', label: 'Browser', desc: "Holds the user's login token (JWT)", tag: 'anon client', tagTone: 'accent' },
          { label: 'API route', desc: 'Receives the token in the header', tag: '/api/…' },
          { label: '① Verify caller', desc: 'anon + getUser() proves identity', tag: 'identity' },
          { tone: 'data', label: '② Service role', desc: 'Trusted key, bypasses row security', tag: 'server only' },
          { tone: 'data', label: 'Postgres', desc: 'Reads / writes the actual data', tag: 'source of truth' },
        ]} />
        <P>
          The <strong style={{ color: '#fff' }}>anon client</strong> (<Mono>lib/supabase.ts</Mono>) runs in the browser, bound by Row-Level
          Security — it can only touch rows the logged-in user owns. The <strong style={{ color: '#fff' }}>service-role client</strong> exists
          only inside an API route, after identity is proven; it bypasses RLS for trusted work. The rule: <strong style={{ color: '#fff' }}>verify
          with the anon key, then act with the service key.</strong>
        </P>
        <Note tone="money" label="Real bug this pattern prevents">
          Cost logging silently failed for months because <Mono>logTokens()</Mono> wrote with the <em>anon</em> key to an
          RLS-locked table — every insert rejected and swallowed. The fix was the service-role key. Same pattern, correctly applied.
        </Note>
      </Section>

      <Section n="03" kicker="Who is who" title="Identity, roles & impersonation">
        <P>Every account is a row in <Mono>profiles</Mono>. A single <Mono>role</Mono> column decides which surface a person sees.</P>
        <Table
          head={['Role', 'Gets', 'Set by']}
          rows={[
            [<K tone="accent">admin</K>, <>Everything + Admin Portal (<Mono>/admin</Mono>)</>, <Dim>manual / owner</Dim>],
            [<K>coach</K>, <>Coach Portal (<Mono>/coach/*</Mono>) + athlete app</>, <Dim>/coaches link · promo</Dim>],
            [<K>beta</K>, <>Full athlete app (early access)</>, <Dim>promo code</Dim>],
            [<K>ff</K>, <>Athlete app (friends &amp; family)</>, <Dim>promo code</Dim>],
            [<K>free</K>, <>Athlete app (default)</>, <Dim>signup default</Dim>],
          ]}
        />
        <P>
          <Mono>AuthContext</Mono> exposes two identities: <Mono>user</Mono> (the real account) and <Mono>effectiveUserId</Mono>
          (whose data to read/write). They match normally; during an admin <strong style={{ color: '#fff' }}>Zoom In</strong> session
          <Mono>effectiveUserId</Mono> swaps to the client so the admin sees their exact experience — while <Mono>user</Mono> stays the
          admin and every action is audited. <strong style={{ color: '#fff' }}>All data reads use <Mono>effectiveUserId</Mono>.</strong>
        </P>
      </Section>

      <Section n="04" kicker="Three surfaces" title="One codebase, three products">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, margin: '10px 0 4px' }}>
          <DomainCard dot={C.accent} title="Athlete app" desc="The consumer product. Daily workout, AI plans, logging, recovery, mindset." items={['/today', '/calendar', '/log', '/recovery', '/for-you', '/my-coach']} />
          <DomainCard dot={C.claude} title="Coach Portal" desc="For trainers. Build programs, manage clients, message, analyze, clone voice." items={['/coach/dashboard', '/coach/builder', '/coach/clients', '/coach/programs', '/coach/messages', '/coach/analytics']} />
          <DomainCard dot={C.money} title="Admin Portal" desc="Owner control room. Content, curation, spend, health, access. Private at launch." items={['#seed', '#video', '#tts', '#spend', '#health', '#access']} />
        </div>
      </Section>

      <Section n="05" kicker="Flagship flow" title="The AI Plan Engine (APIE)">
        <P>
          When an athlete generates a plan, <Mono>/api/generate-plan</Mono> runs a multi-agent RAG pipeline: retrieve coaching
          knowledge by vector search, then pass a draft through specialist <strong style={{ color: C.claude }}>Claude</strong> agents,
          each rewriting its slice. Any agent failure is non-fatal — the plan still returns.
        </P>
        <Flow nodes={[
          { tone: 'openai', label: 'RAG retrieval', desc: 'Embed profile, search 784-item store', tag: 'embeddings' },
          { tone: 'claude', label: 'S&C Agent', desc: 'Drafts the 7-day plan', tag: 'Claude' },
          { tone: 'claude', label: 'PT / Rehab', desc: 'Safety pass; has veto', tag: 'Claude' },
          { tone: 'claude', label: 'Sports Spec.', desc: 'Warmup + coaching to sport', tag: 'Claude' },
          { tone: 'claude', label: 'Mobility', desc: 'Morning / cooldown / evening', tag: 'Claude' },
          { tone: 'claude', label: 'Mindset', desc: 'Warrior-philosophy layer', tag: 'Claude' },
          { tone: 'claude', label: 'Recovery', desc: 'Rest-day programming', tag: 'Claude' },
          { tone: 'data', label: '7-day plan', desc: 'Saved to training_programs', tag: 'Postgres' },
        ]} />
      </Section>

      <Section n="06" kicker="Coach ↔ athlete" title="Coached Mode">
        <P>When a coach takes on an athlete, the coach's program <em>takes over</em> the app — the AI plan pauses. Explicit and reversible.</P>
        <Flow nodes={[
          { tone: 'claude', label: 'Coach builds', desc: 'Manual/AI → coach_programs', tag: 'Coach Portal' },
          { label: 'Assign', desc: 'Pending assignment + push', tag: 'assignment' },
          { label: 'Athlete activates', desc: 'Taps Activate → active', tag: 'consent' },
          { tone: 'data', label: 'Coached calendar', desc: 'CoachedContext serves it app-wide', tag: 'takeover' },
          { tone: 'data', label: 'Athlete logs', desc: 'Sets → workout_logs', tag: 'Postgres' },
        ]} />
        <P>
          Layered on top: real-time <strong style={{ color: '#fff' }}>messaging</strong> (Realtime), per-client <strong style={{ color: '#fff' }}>notes</strong>,
          compliance <strong style={{ color: '#fff' }}>analytics</strong>, coach-side session logging, and optional <strong style={{ color: '#fff' }}>voice
          cloning</strong> (ElevenLabs) so the read-aloud button speaks cues in the coach's own voice.
        </P>
      </Section>

      <Section n="07" kicker="Filling the library" title="The content engine">
        <P>The exercise library is preloaded for zero-lag plans. One admin tool feeds two pipelines — text by <strong style={{ color: C.claude }}>Claude</strong>, voice by <strong style={{ color: C.openai }}>OpenAI</strong>, video by curation.</P>
        <Flow nodes={[
          { tone: 'claude', label: 'Library Builder', desc: 'Real exercises + cues per sport, dedupes', tag: 'Claude' },
          { tone: 'data', label: 'exercise_library', desc: 'name, how, breathing, core, tip', tag: 'Postgres' },
          { tone: 'claude', label: 'Video Curation', desc: 'Claude scores YouTube clips', tag: 'Claude + YouTube' },
        ]} />
        <Flow nodes={[
          { tone: 'data', label: 'exercise_library', desc: 'rows missing audio', tag: 'Postgres' },
          { tone: 'openai', label: 'TTS voicing', desc: 'Male (onyx) + female (nova) MP3s', tag: 'OpenAI' },
          { tone: 'data', label: 'Storage + CDN', desc: 'Cached audio, served free', tag: 'Supabase' },
        ]} />
        <P>
          Guards keep it cheap: the builder <strong style={{ color: '#fff' }}>remembers saturated categories</strong> and skips them free;
          voicing runs a <strong style={{ color: '#fff' }}>hands-free loop</strong> (20 at a time, 8-wide) until done; the upgrade pass finds
          stragglers by <strong style={{ color: '#fff' }}>staleness</strong> so it never re-charges finished rows.
        </P>
      </Section>

      <Section n="08" kicker="Following the money" title="Cost tracking">
        <P>
          Every route that spends on an AI provider logs the exact dollar cost. Providers bill differently — Claude per
          <em> token</em>, OpenAI per <em>character</em> (TTS), <em>token</em> (embeddings), or <em>minute</em> (Whisper) — so each route
          computes its own cost and the Spend Tracker sums the stored figures.
        </P>
        <Flow nodes={[
          { tone: 'claude', label: 'Any AI route', desc: 'Plan gen, TTS, embeddings…', tag: 'spends money' },
          { label: 'lib/ai-costs.ts', desc: 'Per-provider pricing → exact $', tag: 'pricing' },
          { tone: 'data', label: 'logTokens()', desc: 'Service-role insert → token_usage', tag: 'Postgres' },
          { tone: 'money', label: 'Spend Tracker', desc: 'Sums $, badges by provider', tag: 'Admin' },
        ]} />
        <Table
          head={['Service', 'Provider', 'Billed by', 'Rate']}
          rows={[
            [<>Plan gen · curation · Library Builder</>, <K tone="claude">Claude</K>, <>input + output tokens</>, <K>$3 / $15 per 1M</K>],
            [<>Read-aloud voices (TTS)</>, <K tone="openai">OpenAI</K>, <>characters</>, <K>$15 / 1M chars</K>],
            [<>Knowledge search (embeddings)</>, <K tone="openai">OpenAI</K>, <>tokens</>, <K>$0.02 / 1M</K>],
            [<>Voice-note transcription (Whisper)</>, <K tone="openai">OpenAI</K>, <>audio minutes</>, <K>$0.006 / min</K>],
            [<>Coach voice cloning</>, <K>ElevenLabs</K>, <>characters</>, <K><Dim>gated</Dim></K>],
          ]}
        />
      </Section>

      <Section n="09" kicker="Single source of truth" title="The database, by domain">
        <P>One Postgres database, ~40 tables, all with Row-Level Security. Grouped by what they do.</P>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, margin: '10px 0 4px' }}>
          <DomainCard dot={C.accent} title="Identity & access" desc="Who people are, what they can touch." items={['profiles', 'promo_codes', 'admin_permissions']} />
          <DomainCard dot={C.accent} title="Plans & programs" desc="AI plans + imported / converted programs." items={['training_programs', 'user_imported_programs', 'plan_conversion_requests']} />
          <DomainCard dot={C.data} title="Exercises & media" desc="The movement library + its media." items={['exercise_library', 'exercise_media', 'exercise_video_candidates', 'approved_yt_channels', 'exercise_set_logs']} />
          <DomainCard dot={C.claude} title="Coaching" desc="Programs, rosters, messaging, content." items={['coach_programs', 'coach_program_weeks', 'coach_program_assignments', 'coach_clients', 'coach_messages', 'coach_client_notes', 'coach_exercise_library', 'coach_voices']} />
          <DomainCard dot={C.openai} title="Knowledge & study" desc="RAG vector store + cert prep." items={['knowledge_items', 'study_kbs', 'study_entries']} />
          <DomainCard dot={C.data} title="Tracking" desc="What athletes actually did." items={['workout_logs', 'day_completions', 'streaks', 'recovery']} />
          <DomainCard dot={C.money} title="Money & ops" desc="Costs, expenses, support signals." items={['token_usage', 'project_expenses', 'bug_reports', 'account_deletion_feedback']} />
        </div>
        <P>Schema changes ship as timestamped SQL migrations in <Mono>supabase/migrations/</Mono> (29 to date), applied by hand in the Supabase SQL editor.</P>
      </Section>

      <Section n="10" kicker="The contractors" title="External services & billing">
        <Table
          head={['Provider', 'Used for', 'Notes']}
          rows={[
            [<K tone="claude">Anthropic</K>, <>Plan agents, coaching cues, video scoring, study material</>, <K><Dim>Haiku · Sonnet · Opus</Dim></K>],
            [<K tone="openai">OpenAI</K>, <>Voices, embeddings, voice-note transcription</>, <K><Dim>tts-1 · embed-3 · whisper</Dim></K>],
            [<K>ElevenLabs</K>, <>Coach voice cloning (premium, flag-gated)</>, <K><Dim>needs API key</Dim></K>],
            [<K tone="money">Stripe + RevenueCat</K>, <>Subscriptions — web via Stripe, iOS via RevenueCat</>, <K><Dim>not live yet</Dim></K>],
            [<K>YouTube Data API</K>, <>Sourcing demo clips for curation</>, <K><Dim>quota-limited</Dim></K>],
          ]}
        />
        <Note tone="money" label="Billing status">
          Payments are wired but <strong style={{ color: '#fff' }}>off</strong> (<Mono>BILLING_LIVE = false</Mono> in <Mono>lib/flags.ts</Mono>).
          iOS requires RevenueCat — Stripe alone would be rejected by Apple. One flag flips every billing-gated feature on at go-live.
        </Note>
      </Section>

      <Section n="11" kicker="Guardrails" title="Security model">
        <Table
          head={['Guardrail', 'What it does']}
          rows={[
            [<K>Row-Level Security</K>, <>Postgres enforces per-row ownership on every table; the browser can&apos;t read another user&apos;s data.</>],
            [<K>Service-role split</K>, <>Trusted writes happen only inside API routes after JWT verification; the secret key never reaches the browser.</>],
            [<K>protect_admin_role</K>, <>A DB trigger blocks any update that would change an admin&apos;s role away from admin — even coach signup can&apos;t demote an admin.</>],
            [<K>SECURITY DEFINER fns</K>, <>Cross-role reads go through controlled functions, not recursive RLS policies (which once caused an admin lockout).</>],
            [<K>admin_permissions</K>, <>Partner admins get scoped, per-section grants; they are not <Mono>is_admin</Mono> and can&apos;t see owner-only data.</>],
            [<K>Impersonation audit</K>, <>Every admin Zoom-In action is written to an audit trail; the real actor is always recorded.</>],
          ]}
        />
      </Section>

      <Section n="12" kicker="Keyboard to production" title="Deploy & ops">
        <Flow nodes={[
          { tone: 'plain', label: 'git push', desc: 'Commit to master', tag: 'GitHub' },
          { label: 'Vercel build', desc: 'Auto · type-checked · Turbopack', tag: 'CI' },
          { tone: 'data', label: 'Production', desc: 'atlasprime.app (+ redirects)', tag: 'live' },
        ]} />
        <P>
          <strong style={{ color: '#fff' }}>master is production</strong> — no staging. Database changes are the one manual step (SQL run by hand
          in Supabase). Secrets live only in Vercel env vars, never in the repo. Health and spend are watched from this portal.
        </P>
        <SelfTest />
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.textDim, marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.borderSoft}` }}>
          A living map — kept in sync with ARCHITECTURE.md &amp; docs/architecture.html when the backend changes.
        </div>
      </Section>
    </div>
  )
}
