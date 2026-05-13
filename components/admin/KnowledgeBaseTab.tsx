'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Category = 'feature' | 'term' | 'competitor'

interface Entry {
  id: string
  category: Category
  our_name: string | null
  industry_name: string | null
  definition: string
  notes: string | null
  isStatic?: boolean
}

interface SearchResult {
  answer: string
  our_implementation: string
  one_liner: string
}

// ─── STATIC KNOWLEDGE ────────────────────────────────────────────────────────
const STATIC_FEATURES: Entry[] = [
  { id: 's-f1', category: 'feature', our_name: 'AI Training Plan Generator', industry_name: 'Personalized Program Generation Engine', definition: 'AI that produces individualized periodized training plans (1–3 months) based on the user\'s sport, experience, equipment, and injury history. Generates all phases at once: Foundation → Build → Peak → Maintenance.', notes: null, isStatic: true },
  { id: 's-f2', category: 'feature', our_name: 'MIE — Movement Intelligence Engine', industry_name: 'Multi-Agent Agentic RAG Pipeline', definition: 'A council of 9 specialized AI agents grounded in a curated Domain Knowledge Store via pgvector. Agents: Orchestrator, S&C, PT/Rehab (veto), Sports Specialist, Mobility, Recovery, Mindset, Critic, Knowledge Curator.', notes: 'PT/Rehab agent has veto power over all other agents for safety.', isStatic: true },
  { id: 's-f3', category: 'feature', our_name: 'Phase-Based Injury Recovery Playbooks', industry_name: 'Phase-Based Rehabilitation Protocols', definition: 'Structured, evidence-based recovery progressions by injury type. Each protocol has distinct phases with specific exercises, progressions, and clearance criteria before advancing.', notes: 'SI Joint (4-phase, 82+ exercises), Elbow (6-phase), Shoulder Impingement (4-phase), Knee Rehab (4-phase).', isStatic: true },
  { id: 's-f4', category: 'feature', our_name: 'Return-to-Sport AI', industry_name: 'Sport-Specific Return-to-Activity Protocol', definition: 'AI agent that generates sport-specific daily progressions for athletes recovering from injury. Bridges the gap between clinical rehab and full sport performance.', notes: 'Example: skateboarding — riding → slappies → 50-50s → 180s.', isStatic: true },
  { id: 's-f5', category: 'feature', our_name: 'Exercise Swap Modal', industry_name: 'Dynamic Exercise Substitution', definition: 'Real-time replacement of exercises within a training plan while automatically preserving the original volume prescription (sets × reps).', notes: null, isStatic: true },
  { id: 's-f6', category: 'feature', our_name: 'Coach Portal', industry_name: 'B2B SaaS Professional Portal', definition: 'Software-as-a-Service tooling for fitness professionals to manage clients: program library, assign programs, AI-generate periodized plans, template reuse, client roster with assignment history.', notes: null, isStatic: true },
  { id: 's-f7', category: 'feature', our_name: 'Anatomy Explorer', industry_name: 'Anatomical Visualization Interface', definition: 'Interactive clickable skeleton (Jarvis HUD aesthetic) with joint matrix and recovery protocol lookup. Users can explore muscle groups and find injury-specific protocols.', notes: null, isStatic: true },
  { id: 's-f8', category: 'feature', our_name: 'For You Feed', industry_name: 'AI-Curated Content Feed', definition: 'Algorithmically personalized motivational and educational content delivery. Sport-specific training tips combined with a Japanese warrior mindset philosophy system (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin).', notes: 'Mindset content from founder\'s published book — proprietary IP.', isStatic: true },
  { id: 's-f9', category: 'feature', our_name: 'Zoom In (Admin)', industry_name: 'Admin Session Escalation', definition: 'Authenticated session escalation allowing admin to impersonate any user account for support and QA purposes. All sessions are logged with duration and reason.', notes: null, isStatic: true },
  { id: 's-f10', category: 'feature', our_name: 'Workout Logging', industry_name: 'Progressive Overload Logging System', definition: 'Session-by-session tracking of sets, reps, and weight per exercise with automatic personal best detection and history.', notes: null, isStatic: true },
  { id: 's-f11', category: 'feature', our_name: 'Exercise Library', industry_name: 'Curated Exercise Repository with AI Annotation', definition: 'Platform-wide exercise database with AI-generated coaching cues, breathing tips, and core activation notes. Generated once per exercise and reused across all plans — zero marginal API cost on repeat.', notes: null, isStatic: true },
  { id: 's-f12', category: 'feature', our_name: 'Program Assignment Workflow', industry_name: 'Structured Protocol Assignment', definition: 'Attaching a periodized training program to a specific client profile in the Coach Portal, with debounced client search and assignment history tracking.', notes: null, isStatic: true },
]

const STATIC_TERMS: Entry[] = [
  { id: 's-t1', category: 'term', our_name: null, industry_name: 'Periodization', definition: 'The systematic planning of athletic training that divides the program into distinct phases (macrocycle → mesocycle → microcycle), each with different goals, volumes, and intensities. Prevents plateau and peaks performance at the right time.', notes: 'Our plans use Foundation → Build → Peak → Maintenance.', isStatic: true },
  { id: 's-t2', category: 'term', our_name: null, industry_name: 'Progressive Overload', definition: 'The gradual increase of stress placed on the body during exercise training. The fundamental principle behind all strength and fitness gains — you must consistently do more (weight, reps, sets, or density) to continue adapting.', notes: null, isStatic: true },
  { id: 's-t3', category: 'term', our_name: null, industry_name: 'RPE (Rate of Perceived Exertion)', definition: 'A subjective 1–10 scale for measuring exercise intensity. RPE 7 = hard but sustainable; RPE 9–10 = near maximal. Used to auto-regulate training without requiring specific weight targets.', notes: null, isStatic: true },
  { id: 's-t4', category: 'term', our_name: null, industry_name: 'RIR (Reps in Reserve)', definition: 'How many more reps you could have done at the end of a set. RIR 2 = left 2 reps in the tank. More precise than RPE for strength programming. "3 sets of 8 at RIR 2" is a complete prescription.', notes: null, isStatic: true },
  { id: 's-t5', category: 'term', our_name: null, industry_name: 'Deload', definition: 'A planned reduction in training volume or intensity (typically 40–60%) to allow accumulated fatigue to dissipate while maintaining fitness adaptations. Usually 1 week every 3–6 weeks of hard training.', notes: null, isStatic: true },
  { id: 's-t6', category: 'term', our_name: null, industry_name: 'RAG (Retrieval-Augmented Generation)', definition: 'An AI architecture that grounds a language model\'s responses in a curated external knowledge store (retrieved at query time) rather than relying on training data alone. Produces more accurate, specific, and verifiable outputs.', notes: 'Our MIE uses pgvector for semantic search over the Domain Knowledge Store.', isStatic: true },
  { id: 's-t7', category: 'term', our_name: null, industry_name: 'Agentic Pipeline', definition: 'An AI system where multiple specialized agents work in sequence or parallel, each with a defined role, passing context between them to produce a unified output. More powerful than a single-model prompt.', notes: 'Our MIE has 9 specialized agents including one with veto power.', isStatic: true },
  { id: 's-t8', category: 'term', our_name: null, industry_name: 'TAM / SAM / SOM', definition: 'Total Addressable Market (everyone who could ever buy), Serviceable Addressable Market (realistic target segment), Serviceable Obtainable Market (what you can realistically capture near-term). Used in investor pitches to frame market size.', notes: 'Our TAM includes global fitness app market ($96B by 2032) + AI health ($45B) + PT software ($3.2B) + B2B training ($1.8B).', isStatic: true },
  { id: 's-t9', category: 'term', our_name: null, industry_name: 'CAC (Customer Acquisition Cost)', definition: 'Total marketing and sales spend divided by number of new customers acquired in the same period. Lower CAC = more efficient growth. Target: CAC < 12-month LTV.', notes: null, isStatic: true },
  { id: 's-t10', category: 'term', our_name: null, industry_name: 'LTV (Lifetime Value)', definition: 'The total revenue a single customer generates over their entire relationship with the platform. LTV = Average Revenue Per User × Average Customer Lifespan. B2B LTV is typically 3–5× higher than B2C.', notes: null, isStatic: true },
  { id: 's-t11', category: 'term', our_name: null, industry_name: 'ARR / MRR', definition: 'Annual Recurring Revenue / Monthly Recurring Revenue. The predictable, subscription-based revenue normalized to annual or monthly periods. The primary health metric for SaaS businesses.', notes: null, isStatic: true },
  { id: 's-t12', category: 'term', our_name: null, industry_name: 'Churn Rate', definition: 'The percentage of subscribers who cancel in a given period. Monthly churn of 2–3% is acceptable for consumer apps; under 1% for B2B SaaS. High churn = product-market fit problem.', notes: null, isStatic: true },
  { id: 's-t13', category: 'term', our_name: null, industry_name: 'Marketplace Flywheel', definition: 'A self-reinforcing growth loop: more users attract more professionals → more professionals attract more users → more data improves the AI → better AI attracts more users. Each side of the marketplace makes the other more valuable.', notes: 'Our flywheel: users → professionals → client data → better MIE → more users.', isStatic: true },
  { id: 's-t14', category: 'term', our_name: null, industry_name: 'Moat', definition: 'A sustainable competitive advantage that is difficult for competitors to replicate. Types: network effects, proprietary data, switching costs, brand, IP, regulatory. The wider the moat, the more defensible the business.', notes: 'Our moat: MIE architecture, training+recovery unification, mindset IP, two-sided marketplace, data flywheel.', isStatic: true },
  { id: 's-t15', category: 'term', our_name: null, industry_name: 'B2B SaaS', definition: 'Business-to-Business Software as a Service. Selling subscription software to other businesses (coaches, PTs, clinics) rather than end consumers. Typically higher contract values, longer sales cycles, but lower churn than B2C.', notes: null, isStatic: true },
  { id: 's-t16', category: 'term', our_name: null, industry_name: 'White-Label', definition: 'A product or service produced by one company and rebranded by another for sale under their own name. In our Phase 5, enterprise clients (gyms, insurance companies) would deploy our platform under their own branding.', notes: null, isStatic: true },
]

const STATIC_COMPETITORS: Entry[] = [
  { id: 's-c1', category: 'competitor', our_name: 'Nike Training Club', industry_name: 'Content Library App', definition: 'Large library of workout videos and structured programs led by celebrity trainers. Free with premium tier ($14.99/mo). Strong brand but zero AI personalization — every user gets the same content. No recovery system, no B2B offering, no injury support, no sport specificity. We win on personalization: our AI reads their specific sport, injuries, equipment, and experience; NTC shows the same video to everyone.', notes: null, isStatic: true },
  { id: 's-c2', category: 'competitor', our_name: 'Whoop', industry_name: 'Biometric Wearable + Recovery App', definition: 'Hardware + app focused on biometric tracking: HRV, sleep quality, strain, and recovery scores. $30/month subscription plus cost of the band. Doesn\'t program workouts at all — it tells you how recovered you are but not what to do about it. We close the loop: Whoop tells you your readiness; we tell you exactly what to train and how hard.', notes: null, isStatic: true },
  { id: 's-c3', category: 'competitor', our_name: 'Fitbod', industry_name: 'AI Gym Workout Generator', definition: 'AI-powered gym workout generator that adapts based on available equipment and muscle fatigue tracking. $12.99/mo or $79.99/yr. Gym workouts only — no recovery system, no sport-specific programming, no B2B coach tooling, no injury rehab. A narrow slice of what we do for gym-goers who don\'t want to think.', notes: null, isStatic: true },
  { id: 's-c4', category: 'competitor', our_name: 'Trainerize / TrueCoach', industry_name: 'B2B Client Management Software', definition: 'Client management platforms for personal trainers: program delivery, messaging, progress photos, payment processing. $5–11/client/month. No AI — coaches build every program manually. No recovery system. No consumer app. We make coaches 10× faster with AI program generation and give them a consumer product their clients actually want to use.', notes: null, isStatic: true },
  { id: 's-c5', category: 'competitor', our_name: 'Athlean-X', industry_name: 'Video Content & Program Brand', definition: 'Jeff Cavaliere\'s fitness brand selling video-based workout programs as digital products ($100–200 one-time). Static, not personalized — the same program regardless of the buyer\'s sport, injury history, or equipment. No app platform, no ongoing AI adaptation, no coach B2B. We are the platform they can\'t build; they are the content brand we don\'t need to become.', notes: null, isStatic: true },
  { id: 's-c6', category: 'competitor', our_name: 'MyFitnessPal', industry_name: 'Nutrition Tracking App', definition: 'The leading calorie and macro tracking app with a massive food database. Free with Premium at $9.99/mo. Nutrition only — no workout programming, no AI coaching, no recovery, no B2B. A potential integration partner rather than a direct competitor; we own training + recovery, they own nutrition.', notes: null, isStatic: true },
  { id: 's-c7', category: 'competitor', our_name: 'Mindbody', industry_name: 'Studio & Gym Booking Platform', definition: 'Business management software for fitness studios and gyms: class booking, staff scheduling, payment processing. $129–499/mo for businesses. Serves studio operations, not individual coaching. No AI, no personalized training, no recovery. Different buyer (studio owner vs individual coach/PT) and different use case entirely.', notes: null, isStatic: true },
]

// ─── MARKDOWN RENDERER (inline, no CSS classes) ───────────────────────────────
function renderMd(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.text};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em style="color:${C.textMid}">$1</em>`)
    .replace(/^[-•] (.+)$/gm, `<div style="display:flex;gap:8px;margin-bottom:5px"><span style="color:${C.accent};font-size:9px;margin-top:4px">●</span><span>$1</span></div>`)
    .replace(/^(?!<[ds])(.*\S.*)$/gm, `<p style="margin-bottom:10px;line-height:1.75">$1</p>`)
    .replace(/<p style[^>]+><\/p>/g, '')
}

// ─── ENTRY CARD ───────────────────────────────────────────────────────────────
function EntryCard({ entry, onEdit, onDelete }: {
  entry: Entry
  onEdit?: (e: Entry) => void
  onDelete?: (id: string) => void
}) {
  const catColor = entry.category === 'feature' ? C.accent
    : entry.category === 'term' ? C.purple
    : C.amber

  return (
    <div style={{
      padding: '16px 18px', borderRadius: 12, border: `1px solid ${C.border}`,
      background: C.surface, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          {entry.our_name && (
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{entry.our_name}</p>
          )}
          {entry.industry_name && (
            <p style={{
              fontSize: entry.our_name ? 11 : 14,
              fontWeight: entry.our_name ? 600 : 700,
              color: catColor,
              fontFamily: entry.our_name ? 'monospace' : 'inherit',
              letterSpacing: entry.our_name ? '0.03em' : 0,
              marginBottom: 2,
            }}>
              {entry.industry_name}
            </p>
          )}
        </div>
        {!entry.isStatic && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {onEdit && <button onClick={() => onEdit(entry)} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 11, cursor: 'pointer' }}>Edit</button>}
            {onDelete && <button onClick={() => onDelete(entry.id)} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid rgba(239,68,68,0.2)`, background: 'transparent', color: C.red, fontSize: 11, cursor: 'pointer' }}>Delete</button>}
          </div>
        )}
        {entry.isStatic && <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace', letterSpacing: '0.06em', flexShrink: 0, marginTop: 2 }}>BUILT-IN</span>}
      </div>
      <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>{entry.definition}</p>
      {entry.notes && (
        <p style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic', lineHeight: 1.5, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
          {entry.notes}
        </p>
      )}
    </div>
  )
}

// ─── ADD / EDIT MODAL ─────────────────────────────────────────────────────────
function EntryModal({ entry, defaultCategory, onSave, onClose }: {
  entry: Entry | null
  defaultCategory: Category
  onSave: (e: Omit<Entry, 'id' | 'isStatic'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<Entry, 'id' | 'isStatic'>>({
    category:      entry?.category ?? defaultCategory,
    our_name:      entry?.our_name ?? '',
    industry_name: entry?.industry_name ?? '',
    definition:    entry?.definition ?? '',
    notes:         entry?.notes ?? '',
  })

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#161b22', border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{entry ? 'Edit Entry' : 'Add Entry'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="feature">Feature</option>
              <option value="term">Industry Term</option>
              <option value="competitor">Competitor</option>
            </select>
          </div>
          {form.category !== 'term' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Our Name (internal)</label>
              <input value={form.our_name ?? ''} onChange={e => set('our_name', e.target.value)} placeholder="e.g. Zoom In" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Industry Name / Term</label>
            <input value={form.industry_name ?? ''} onChange={e => set('industry_name', e.target.value)} placeholder="e.g. Admin Session Escalation" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Definition <span style={{ color: C.red }}>*</span></label>
            <textarea value={form.definition} onChange={e => set('definition', e.target.value)} placeholder="What this is and why it matters…" rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }}>Notes (optional)</label>
            <input value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Additional context, examples…" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button
            onClick={() => { if (form.definition.trim()) onSave(form) }}
            disabled={!form.definition.trim()}
            style={{ padding: '11px', borderRadius: 9, border: 'none', background: form.definition.trim() ? C.accent : C.surface2, color: form.definition.trim() ? '#fff' : C.textDim, fontSize: 14, fontWeight: 700, cursor: form.definition.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
          >
            {entry ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function KnowledgeBaseTab() {
  const [query, setQuery]             = useState('')
  const [searching, setSearching]     = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState('')

  const [sectionTab, setSectionTab]   = useState<Category>('feature')
  const [localFilter, setLocalFilter] = useState('')

  const [customEntries, setCustomEntries] = useState<Entry[]>([])
  const [showModal, setShowModal]     = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadCustomEntries() }, [])

  async function loadCustomEntries() {
    const { data } = await supabase.from('knowledge_base').select('*').order('created_at', { ascending: false })
    setCustomEntries((data ?? []) as Entry[])
  }

  async function search() {
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    setSearchError('')
    setSearchResult(null)
    try {
      const res = await fetch('/api/admin/knowledge-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSearchResult(data.result)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function saveEntry(form: Omit<Entry, 'id' | 'isStatic'>) {
    if (editingEntry) {
      await supabase.from('knowledge_base').update({
        category:      form.category,
        our_name:      form.our_name || null,
        industry_name: form.industry_name || null,
        definition:    form.definition,
        notes:         form.notes || null,
        updated_at:    new Date().toISOString(),
      }).eq('id', editingEntry.id)
    } else {
      await supabase.from('knowledge_base').insert({
        category:      form.category,
        our_name:      form.our_name || null,
        industry_name: form.industry_name || null,
        definition:    form.definition,
        notes:         form.notes || null,
      })
    }
    setShowModal(false)
    setEditingEntry(null)
    loadCustomEntries()
  }

  async function deleteEntry(id: string) {
    await supabase.from('knowledge_base').delete().eq('id', id)
    setCustomEntries(prev => prev.filter(e => e.id !== id))
  }

  const STATIC_BY_CAT: Record<Category, Entry[]> = {
    feature:    STATIC_FEATURES,
    term:       STATIC_TERMS,
    competitor: STATIC_COMPETITORS,
  }

  const allEntries = [
    ...STATIC_BY_CAT[sectionTab],
    ...customEntries.filter(e => e.category === sectionTab),
  ]

  const filtered = localFilter.trim()
    ? allEntries.filter(e =>
        [e.our_name, e.industry_name, e.definition, e.notes]
          .some(f => f?.toLowerCase().includes(localFilter.toLowerCase()))
      )
    : allEntries

  const SECTION_TABS: { id: Category; label: string; count: number }[] = [
    { id: 'feature',    label: 'Features',    count: STATIC_FEATURES.length + customEntries.filter(e => e.category === 'feature').length },
    { id: 'term',       label: 'Terms',       count: STATIC_TERMS.length + customEntries.filter(e => e.category === 'term').length },
    { id: 'competitor', label: 'Competitors', count: STATIC_COMPETITORS.length + customEntries.filter(e => e.category === 'competitor').length },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Founder Reference</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginBottom: 4 }}>Knowledge Base</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>Every feature, industry term, and competitor — searchable, editable, always ready for a pitch.</p>
      </div>

      {/* AI Search */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search() }}
            placeholder="Ask anything — how do we handle injury recovery? What's the difference between us and Fitbod? What is CAC?"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10,
              border: `1px solid ${C.border}`, background: C.surface,
              color: C.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = C.accentBorder}
            onBlur={e => e.target.style.borderColor = C.border}
          />
          <button
            onClick={search}
            disabled={!query.trim() || searching}
            style={{
              padding: '12px 20px', borderRadius: 10, border: 'none',
              background: query.trim() && !searching ? C.accent : C.surface2,
              color: query.trim() && !searching ? '#fff' : C.textDim,
              fontSize: 14, fontWeight: 700, cursor: query.trim() && !searching ? 'pointer' : 'not-allowed',
              flexShrink: 0, transition: 'all 0.15s', fontFamily: 'inherit',
            }}
          >
            {searching ? '…' : 'Ask →'}
          </button>
        </div>

        {/* Search result */}
        {searching && (
          <div style={{ marginTop: 14, padding: '18px 20px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, color: C.textDim, fontSize: 13 }}>
            Searching…
          </div>
        )}
        {searchError && (
          <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: C.red }}>
            {searchError}
          </div>
        )}
        {searchResult && !searching && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Answer */}
            <div style={{ padding: '18px 20px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.accent, marginBottom: 10 }}>Answer</p>
              <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: renderMd(searchResult.answer) }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Our Implementation */}
              <div style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid rgba(34,197,94,0.25)`, background: 'rgba(34,197,94,0.06)' }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.green, marginBottom: 8 }}>How We Implement This</p>
                <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>{searchResult.our_implementation}</p>
              </div>
              {/* One-liner */}
              <div style={{ padding: '14px 16px', borderRadius: 12, background: C.amberDim, border: `1px solid rgba(245,158,11,0.25)` }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.amber, marginBottom: 8 }}>💬 One-Liner</p>
                <p style={{ fontSize: 13, color: C.text, fontStyle: 'italic', fontWeight: 600, lineHeight: 1.5 }}>"{searchResult.one_liner}"</p>
              </div>
            </div>
            <button onClick={() => { setSearchResult(null); setQuery(''); inputRef.current?.focus() }} style={{ alignSelf: 'flex-start', fontSize: 11, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              ↩ Clear
            </button>
          </div>
        )}
      </div>

      {/* Section sub-tabs + filter + add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {SECTION_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setSectionTab(t.id); setLocalFilter('') }}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: sectionTab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
                background: 'none',
                color: sectionTab === t.id ? C.accent : C.textDim,
                fontSize: 13, fontWeight: sectionTab === t.id ? 700 : 400,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
              }}
            >
              {t.label} <span style={{ fontSize: 11, opacity: 0.7 }}>({t.count})</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditingEntry(null); setShowModal(true) }}
          style={{
            padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.accentBorder}`,
            background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 1,
          }}
        >
          + Add Entry
        </button>
      </div>

      {/* Client-side filter */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={localFilter}
          onChange={e => setLocalFilter(e.target.value)}
          placeholder={`Filter ${sectionTab === 'feature' ? 'features' : sectionTab === 'term' ? 'terms' : 'competitors'}…`}
          style={{
            width: '100%', padding: '9px 14px', borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.surface2,
            color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            boxSizing: 'border-box', transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = C.accentBorder}
          onBlur={e => e.target.style.borderColor = C.border}
        />
      </div>

      {/* Entry grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim }}>
          <p style={{ fontSize: 14 }}>No entries match "{localFilter}"</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {filtered.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={entry.isStatic ? undefined : e => { setEditingEntry(e); setShowModal(true) }}
              onDelete={entry.isStatic ? undefined : deleteEntry}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <EntryModal
          entry={editingEntry}
          defaultCategory={sectionTab}
          onSave={saveEntry}
          onClose={() => { setShowModal(false); setEditingEntry(null) }}
        />
      )}
    </div>
  )
}
