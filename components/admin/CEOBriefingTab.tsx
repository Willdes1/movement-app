'use client'
import { useState, useRef, useEffect } from 'react'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type SubTab = 'brief' | 'ask'

interface Article {
  type_id: string
  headline: string
  read_time: string
  summary: string
  body: string
  our_angle: string
  one_liner: string
}

interface ArticleType {
  id: string
  label: string
  emoji: string
  color: string
}

interface AMAResponse {
  answer: string
  industry_context: string
  our_angle: string
  one_liner: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  question?: string
  response?: AMAResponse
  content?: string
}

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────
function renderMd(md: string): string {
  return md
    .replace(/^## (.+)$/gm, `<h2 style="font-size:17px;font-weight:800;color:${C.text};margin:24px 0 8px;letter-spacing:-0.01em">$1</h2>`)
    .replace(/^### (.+)$/gm, `<h3 style="font-size:14px;font-weight:700;color:${C.text};margin:18px 0 6px">$1</h3>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-size:20px;font-weight:900;color:${C.text};margin:28px 0 10px">$1</h1>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.text};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em style="color:${C.textMid}">$1</em>`)
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid ${C.border};margin:20px 0">`)
    .replace(/^[-•] (.+)$/gm, `<div style="display:flex;gap:10px;margin-bottom:7px;align-items:flex-start"><span style="color:${C.accent};flex-shrink:0;margin-top:3px;font-size:10px">●</span><span style="font-size:14px;color:${C.textMid};line-height:1.7">$1</span></div>`)
    .replace(/^\d+\. (.+)$/gm, `<div style="display:flex;gap:10px;margin-bottom:7px;align-items:flex-start"><span style="color:${C.accent};flex-shrink:0;font-weight:800;margin-top:2px;font-size:13px;min-width:16px">·</span><span style="font-size:14px;color:${C.textMid};line-height:1.7">$1</span></div>`)
    .replace(/^(?!<[h|d|h])(.*\S.*)$/gm, `<p style="font-size:14px;color:${C.textMid};line-height:1.8;margin-bottom:10px">$1</p>`)
    .replace(/<p style[^>]+><\/p>/g, '')
}

// ─── BRIEF ARTICLE VIEW ───────────────────────────────────────────────────────
function ArticleView({ article, articleType, onRefresh, loading }: {
  article: Article
  articleType: ArticleType
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <div>
      {/* Article header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: 20,
              background: `${articleType.color}18`,
              color: articleType.color,
              border: `1px solid ${articleType.color}40`,
            }}>
              {articleType.emoji} {articleType.label}
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{article.read_time}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: C.text, lineHeight: 1.2, marginBottom: 0 }}>
            {article.headline}
          </h1>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Generate a new article"
          style={{
            padding: '9px 16px', borderRadius: 9, border: `1px solid ${C.border}`,
            background: loading ? C.surface2 : C.surface,
            color: loading ? C.textDim : C.textMid,
            fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none', fontSize: 14 }}>↺</span>
          {loading ? 'Generating…' : 'New Article'}
        </button>
      </div>

      {/* 30-Second Version */}
      <div style={{
        padding: '18px 22px', borderRadius: 12, marginBottom: 24,
        background: C.accentDim,
        border: `1px solid ${C.accentBorder}`,
        borderLeft: `4px solid ${C.accent}`,
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accent, marginBottom: 8 }}>⚡ The 30-Second Version</p>
        <p style={{ fontSize: 15, color: C.text, lineHeight: 1.7, fontWeight: 500 }}>{article.summary}</p>
      </div>

      {/* Article body */}
      <div
        style={{ marginBottom: 28 }}
        dangerouslySetInnerHTML={{ __html: renderMd(article.body) }}
      />

      {/* How This Applies to Us */}
      <div style={{
        padding: '18px 22px', borderRadius: 12, marginBottom: 24,
        background: C.greenDim,
        border: `1px solid rgba(34,197,94,0.25)`,
        borderLeft: `4px solid ${C.green}`,
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green, marginBottom: 8 }}>🎯 How This Applies to Us</p>
        <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.75 }}>{article.our_angle}</p>
      </div>

      {/* One-Liner */}
      <div style={{
        padding: '22px 26px', borderRadius: 12,
        background: C.amberDim,
        border: `1px solid rgba(245,158,11,0.25)`,
        borderLeft: `4px solid ${C.amber}`,
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.amber, marginBottom: 10 }}>💬 One Line You Can Use</p>
        <p style={{ fontSize: 16, color: C.text, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 600 }}>"{article.one_liner}"</p>
      </div>
    </div>
  )
}

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
function BriefSkeleton() {
  const shimmer = { background: `linear-gradient(90deg, ${C.surface2} 25%, ${C.border} 50%, ${C.surface2} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 6 }
  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ ...shimmer, width: 140, height: 26 }} />
        <div style={{ ...shimmer, width: 60, height: 20 }} />
      </div>
      <div style={{ ...shimmer, width: '90%', height: 32, marginBottom: 10 }} />
      <div style={{ ...shimmer, width: '70%', height: 32, marginBottom: 32 }} />
      <div style={{ ...shimmer, width: '100%', height: 88, marginBottom: 24, borderRadius: 12 }} />
      {[100, 95, 88, 92, 85, 78].map((w, i) => (
        <div key={i} style={{ ...shimmer, width: `${w}%`, height: 18, marginBottom: 12 }} />
      ))}
      <div style={{ ...shimmer, width: '100%', height: 88, marginTop: 24, borderRadius: 12 }} />
    </div>
  )
}

// ─── DAILY BRIEF SUB-TAB ─────────────────────────────────────────────────────
function DailyBriefTab() {
  const [article, setArticle] = useState<Article | null>(null)
  const [articleType, setArticleType] = useState<ArticleType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seenTypes, setSeenTypes] = useState<string[]>([])

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/ceo-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeTypes: seenTypes }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setArticle(data.article)
      setArticleType(data.type)
      setSeenTypes(prev => {
        const next = [...prev, data.type.id]
        return next.length >= 7 ? [] : next // reset after all 7 types shown
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate on first load
  useEffect(() => { generate() }, [])

  if (loading && !article) return <BriefSkeleton />

  if (error) return (
    <div style={{ padding: '20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, marginTop: 16 }}>
      <p style={{ color: C.red, fontSize: 13 }}>{error}</p>
      <button onClick={generate} style={{ marginTop: 10, padding: '7px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, cursor: 'pointer' }}>Try Again</button>
    </div>
  )

  if (!article || !articleType) return null

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: `${C.bg}cc`, borderRadius: 12, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.accent }}>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: `2px solid ${C.accentBorder}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Generating your next briefing…</span>
          </div>
        </div>
      )}
      <ArticleView article={article} articleType={articleType} onRefresh={generate} loading={loading} />
    </div>
  )
}

// ─── ASK ME ANYTHING SUB-TAB ─────────────────────────────────────────────────
function AskMeAnythingTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function ask() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setError('')

    const userMsg: ChatMessage = { role: 'user', question: q, content: q }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Build history for API (last 6 turns, flattened to role + content)
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.role === 'user' ? (m.question ?? '') : JSON.stringify(m.response ?? ''),
      }))

      const res = await fetch('/api/admin/ceo-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg: ChatMessage = { role: 'assistant', response: data.response, content: JSON.stringify(data.response) }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get an answer')
      setMessages(prev => prev.slice(0, -1)) // remove the user message on error
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const EXAMPLE_QUESTIONS = [
    'How do coaching platforms usually handle workout generation — manual or AI? How do we compare?',
    'What\'s the difference between TAM, SAM, and SOM? What are ours?',
    "If a PT clinic asks why they should use us instead of Trainerize, what do I say?",
    'What is periodization, and how does ours work?',
    'What\'s a "moat" and do we have one?',
    'How do I explain the MIE to someone who has never heard of RAG?',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>

      {/* Conversation */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {messages.length === 0 ? (
          <div>
            <p style={{ fontSize: 14, color: C.textDim, marginBottom: 20 }}>
              Ask anything about the platform, industry, competitors, or business. Get sharp, specific answers with the exact language to use.
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Try asking…</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  style={{
                    padding: '11px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.textMid, fontSize: 13, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', lineHeight: 1.5,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accentBorder}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  /* User message */
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', padding: '12px 16px', borderRadius: '14px 14px 4px 14px',
                      background: C.accent, color: '#fff', fontSize: 14, lineHeight: 1.6,
                    }}>
                      {msg.question}
                    </div>
                  </div>
                ) : msg.response ? (
                  /* Assistant response */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Direct Answer */}
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
                      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.accent, marginBottom: 10 }}>Answer</p>
                      <div dangerouslySetInnerHTML={{ __html: renderMd(msg.response.answer) }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {/* Industry Context */}
                      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.purple, marginBottom: 8 }}>Industry Context</p>
                        <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>{msg.response.industry_context}</p>
                      </div>

                      {/* Our Angle */}
                      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.green, marginBottom: 8 }}>Our Angle</p>
                        <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>{msg.response.our_angle}</p>
                      </div>
                    </div>

                    {/* One-Liner */}
                    <div style={{ padding: '14px 18px', background: C.amberDim, border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.amber, marginBottom: 6 }}>💬 One-Liner</p>
                      <p style={{ fontSize: 14, color: C.text, fontStyle: 'italic', fontWeight: 600, lineHeight: 1.5 }}>"{msg.response.one_liner}"</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: C.textDim }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: 13 }}>Thinking…</span>
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 13, color: C.red }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 16 }}>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ fontSize: 11, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0, display: 'block' }}
          >
            ↩ Clear conversation
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
            placeholder="Ask anything about the platform, industry, or business…"
            rows={2}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${C.border}`, background: C.surface2,
              color: C.text, fontSize: 14, fontFamily: 'inherit',
              resize: 'none', outline: 'none', lineHeight: 1.5,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = C.accentBorder}
            onBlur={e => e.target.style.borderColor = C.border}
          />
          <button
            onClick={ask}
            disabled={!input.trim() || loading}
            style={{
              padding: '12px 20px', borderRadius: 10, border: 'none',
              background: input.trim() && !loading ? C.accent : C.surface2,
              color: input.trim() && !loading ? '#fff' : C.textDim,
              fontSize: 14, fontWeight: 700, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            Ask →
          </button>
        </div>
        <p style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>Enter to send · Shift+Enter for new line</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      `}</style>
    </div>
  )
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function CEOBriefingTab() {
  const [subTab, setSubTab] = useState<SubTab>('brief')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Founder Intelligence</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginBottom: 4 }}>CEO Briefing</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>Your personal education agent. Know your platform. Sound like you built it. Because you did.</p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 1 }}>
        {([
          { id: 'brief' as SubTab, label: '📰 Daily Brief' },
          { id: 'ask'   as SubTab, label: '💬 Ask Me Anything' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '9px 18px', border: 'none',
              borderBottom: subTab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: 'none',
              color: subTab === t.id ? C.accent : C.textDim,
              fontSize: 13, fontWeight: subTab === t.id ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'brief' && <DailyBriefTab />}
      {subTab === 'ask'   && <AskMeAnythingTab />}
    </div>
  )
}
