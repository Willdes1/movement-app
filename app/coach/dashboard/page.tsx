'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import OnboardingOverlay from '@/components/coach/OnboardingOverlay'
import VoiceCloneCard from '@/components/coach/VoiceCloneCard'
import { COACH_VOICE_CLONING } from '@/lib/flags'

interface Stats { activeClients: number; totalPrograms: number; activeAssignments: number }

interface RecentRow {
  id: string
  client_name: string
  program_name: string
  start_date: string
  status: string
  client_id: string
}

const STATUS_DOT: Record<string, string> = {
  active: '#22c55e', completed: '#3b82f6', paused: '#f59e0b', cancelled: '#6b7280',
}

export default function CoachDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats]             = useState<Stats>({ activeClients: 0, totalPrograms: 0, activeAssignments: 0 })
  const [recent, setRecent]           = useState<RecentRow[]>([])
  const [inviteCode, setInviteCode]   = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [genLoading, setGenLoading]   = useState(false)
  const [copied, setCopied]           = useState(false)

  // Vanity join link
  const [slug, setSlug]               = useState<string | null>(null)
  const [slugDraft, setSlugDraft]     = useState('')
  const [slugEditing, setSlugEditing] = useState(false)
  const [slugSaving, setSlugSaving]   = useState(false)
  const [slugError, setSlugError]     = useState('')
  const [linkCopied, setLinkCopied]   = useState(false)

  useEffect(() => { if (user) load() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)

    const [clientsRes, programsRes, assignRes, codesRes, profileRes] = await Promise.all([
      supabase.from('coach_clients').select('id', { count: 'exact', head: true }).eq('coach_id', user!.id).eq('status', 'active'),
      supabase.from('coach_programs').select('id', { count: 'exact', head: true }).eq('coach_id', user!.id),
      supabase.from('coach_program_assignments').select('id', { count: 'exact', head: true }).eq('coach_id', user!.id).eq('status', 'active'),
      supabase.from('coach_invite_codes').select('code').eq('coach_id', user!.id).eq('active', true).order('created_at', { ascending: false }).limit(1),
      supabase.from('profiles').select('coach_slug, name').eq('id', user!.id).single(),
    ])

    setStats({
      activeClients:    clientsRes.count  ?? 0,
      totalPrograms:    programsRes.count ?? 0,
      activeAssignments: assignRes.count  ?? 0,
    })

    const codes = (codesRes.data ?? []) as { code: string }[]
    if (codes.length) setInviteCode(codes[0].code)

    const existingSlug = (profileRes.data as { coach_slug: string | null; name: string | null } | null)?.coach_slug ?? null
    setSlug(existingSlug)
    if (!existingSlug) {
      // Suggest a slug from the coach's name
      const suggested = ((profileRes.data as { name: string | null } | null)?.name ?? '')
        .toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40)
      setSlugDraft(suggested)
    }

    // Recent assignments with client names
    const { data: assignData } = await supabase
      .from('coach_program_assignments')
      .select('id, client_id, status, start_date, coach_programs(name)')
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(8)

    if (assignData?.length) {
      const ids = [...new Set((assignData as any[]).map(a => a.client_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids)
      const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.name ?? 'Unknown']))
      setRecent((assignData as any[]).map(a => ({
        id: a.id,
        client_id: a.client_id,
        client_name: nameMap.get(a.client_id) ?? 'Unknown',
        program_name: (a.coach_programs as { name: string }[])?.[0]?.name ?? 'Program',
        start_date: a.start_date,
        status: a.status,
      })))
    }

    setLoading(false)
  }

  async function generateCode() {
    setGenLoading(true)
    // Deactivate existing codes
    await supabase.from('coach_invite_codes').update({ active: false }).eq('coach_id', user!.id)
    const code = (Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6)).toUpperCase()
    const { error } = await supabase.from('coach_invite_codes').insert({ coach_id: user!.id, code, active: true })
    if (!error) setInviteCode(code)
    setGenLoading(false)
  }

  async function copyCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function joinUrl(s: string) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${s}`
  }

  async function saveSlug() {
    const cleaned = slugDraft.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
    if (cleaned.length < 3) { setSlugError('At least 3 characters — letters, numbers, hyphens.'); return }
    setSlugSaving(true); setSlugError('')
    const { error } = await supabase.from('profiles').update({ coach_slug: cleaned }).eq('id', user!.id)
    if (error) {
      setSlugError(error.code === '23505' ? 'That link is taken — try another.' : error.message)
    } else {
      setSlug(cleaned)
      setSlugEditing(false)
    }
    setSlugSaving(false)
  }

  async function copyLink() {
    if (!slug) return
    await navigator.clipboard.writeText(joinUrl(slug))
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="coach-page">
      <OnboardingOverlay />
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Atlas Prime
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Dashboard</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 26 }}>
        {[
          { label: 'Active Clients',     value: stats.activeClients,     icon: '👥', href: '/coach/clients' },
          { label: 'Total Programs',     value: stats.totalPrograms,     icon: '📋', href: '/coach/programs' },
          { label: 'Active Assignments', value: stats.activeAssignments, icon: '⚡', href: null },
        ].map(card => (
          <div
            key={card.label}
            onClick={card.href ? () => router.push(card.href!) : undefined}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14,
              padding: '20px 22px', cursor: card.href ? 'pointer' : 'default',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2 }}>
              {loading ? '…' : card.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Invite Code + Quick Actions */}
      <div className="coach-grid-2" style={{ gap: 20, marginBottom: 26 }}>
        {/* Invite code */}
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--accent-border, rgba(59,130,246,0.3))', borderRadius: 14, padding: '22px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Client Invite Code
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
            Share this code with clients. They enter it in their Account page to join your roster instantly.
          </p>

          {inviteCode ? (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <div style={{
                  flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px', fontFamily: 'monospace',
                  fontSize: 24, fontWeight: 900, letterSpacing: '0.15em', color: 'var(--accent)', textAlign: 'center',
                }}>
                  {inviteCode}
                </div>
                <button
                  onClick={copyCode}
                  style={{
                    padding: '12px 18px', borderRadius: 10, border: 'none',
                    background: copied ? '#22c55e' : 'var(--accent)', color: '#fff',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                  }}
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
              <button
                onClick={generateCode}
                disabled={genLoading}
                style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {genLoading ? 'Regenerating…' : '↺ Regenerate code'}
              </button>
            </>
          ) : (
            <button
              onClick={generateCode}
              disabled={genLoading}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {genLoading ? 'Generating…' : '+ Generate Invite Code'}
            </button>
          )}

          {/* Vanity join link */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Your Join Link
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
              One tap for new clients: they sign up through your personal link and land connected to you automatically.
            </p>

            {slug && !slugEditing ? (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{
                    flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '11px 14px', fontFamily: 'monospace',
                    fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {joinUrl(slug)}
                  </div>
                  <button
                    onClick={copyLink}
                    style={{
                      padding: '11px 18px', borderRadius: 10, border: 'none',
                      background: linkCopied ? '#22c55e' : 'var(--accent)', color: '#fff',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                    }}
                  >
                    {linkCopied ? '✓' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => { setSlugDraft(slug); setSlugEditing(true); setSlugError('') }}
                  style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ✏️ Edit link
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0 }}>/join/</span>
                  <input
                    value={slugDraft}
                    onChange={e => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-name-or-brand"
                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={saveSlug}
                    disabled={slugSaving}
                    style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', opacity: slugSaving ? 0.6 : 1 }}
                  >
                    {slugSaving ? '…' : 'Save'}
                  </button>
                </div>
                {slugError && <p style={{ fontSize: 11, color: '#ff3b30', margin: 0 }}>{slugError}</p>}
              </>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '+ Build New Program', href: '/coach/builder', primary: true },
              { label: '📋 All Programs',     href: '/coach/programs' },
              { label: '👥 Clients',          href: '/coach/clients' },
            ].map(item => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  padding: '10px 14px', borderRadius: 9, textAlign: 'left', fontFamily: 'inherit',
                  border: item.primary ? 'none' : '1px solid var(--border)',
                  background: item.primary ? 'var(--accent)' : 'var(--surface)',
                  color: item.primary ? '#fff' : 'var(--text)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coaching voice (premium) */}
      {COACH_VOICE_CLONING && <VoiceCloneCard />}

      {/* Recent assignments */}
      {(loading || recent.length > 0) && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Recent Assignments
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading…</p>
          ) : (
            <div>
              {recent.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 0',
                    borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                    color: 'var(--accent)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
                  }}>
                    {initials(a.client_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => router.push(`/coach/clients/${a.client_id}`)}
                      style={{ fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', textAlign: 'left' }}
                    >
                      {a.client_name}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>{a.program_name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                    {fmtDate(a.start_date)}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: STATUS_DOT[a.status] ?? '#6b7280', flexShrink: 0,
                  }}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && recent.length === 0 && stats.activeClients === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 40px', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to coach</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
            Generate your invite code above, share it with clients, then build your first program.
          </div>
          <button
            onClick={() => router.push('/coach/builder')}
            style={{ padding: '12px 28px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
          >
            Build First Program
          </button>
        </div>
      )}
    </div>
  )
}
