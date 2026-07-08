'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import ProductTelemetry from './ProductTelemetry'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type HarnessEvent = {
  id: string
  created_at: string
  event_type: string
  severity: string
  context: string | null
  message: string
  metadata: Record<string, unknown> | null
  effective_user_id: string | null
}
type MigrationStatus = {
  ledgerReady: boolean
  total: number
  appliedCount?: number
  pending?: string[]
  orphan?: string[]
}
type SmokeCheck = { name: string; ok: boolean; detail: string; skipped?: boolean }
type SmokeResult = { ok: boolean; ranAt: string; passed: number; total: number; checks: SmokeCheck[] }

// Severity → badge colors (mirrors the Spend Tracker's provider-badge pattern).
function sevStyle(sev: string): { color: string; bg: string } {
  switch (sev) {
    case 'critical': return { color: '#f472b6', bg: 'rgba(244,114,182,0.14)' }
    case 'error':    return { color: C.red,     bg: 'rgba(239,68,68,0.12)' }
    case 'warn':     return { color: C.amber,   bg: C.amberDim }
    default:         return { color: C.accent,  bg: C.accentDim } // info
  }
}

// Event type → a small human label + emoji.
function typeLabel(t: string): string {
  switch (t) {
    case 'verify_fail':     return '🔴 verify_fail'
    case 'route_error':     return '💥 route_error'
    case 'smoke_fail':      return '🧪 smoke_fail'
    case 'migration_drift': return '🌀 migration_drift'
    default:                return t
  }
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function TelemetryTab() {
  const [events, setEvents]     = useState<HarnessEvent[]>([])
  const [loading, setLoading]   = useState(true)
  const [pending, setPending]   = useState(false)   // migration not applied yet
  const [sentry, setSentry]     = useState(false)   // SENTRY_DSN configured on server
  const [firing, setFiring]     = useState(false)
  const [flash, setFlash]       = useState('')
  const [err, setErr]           = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [migration, setMigration] = useState<MigrationStatus | null>(null)
  const [smokeRunning, setSmokeRunning] = useState(false)
  const [smoke, setSmoke] = useState<SmokeResult | null>(null)
  const [view, setView] = useState<'system' | 'product'>('system')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}` }
      const [evRes, mgRes] = await Promise.all([
        fetch('/api/admin/harness-events', { headers }),
        fetch('/api/admin/migration-drift', { headers }),
      ])
      const d = await evRes.json().catch(() => ({}))
      if (!evRes.ok) { setErr(d.error || 'Failed to load telemetry.'); setEvents([]) }
      else {
        setEvents((d.events ?? []) as HarnessEvent[])
        setPending(!!d.pendingMigration)
        setSentry(!!d.sentryConfigured)
      }
      const m = await mgRes.json().catch(() => null)
      setMigration(mgRes.ok ? (m as MigrationStatus) : null)
    } catch {
      setErr('Failed to load telemetry.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showFlash(m: string) { setFlash(m); setTimeout(() => setFlash(''), 4000) }

  async function fireTestError() {
    setFiring(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // The route throws on purpose → responds 500. Any response means it fired.
      await fetch('/api/admin/harness-test-error', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      showFlash('Test error fired — reloading. Look for the newest 💥 route_error row below.')
      // brief beat so the harness_events insert commits before we re-read
      await new Promise(r => setTimeout(r, 900))
      await load()
    } catch {
      showFlash('Could not fire the test error.')
    }
    setFiring(false)
  }

  async function runSmoke() {
    setSmokeRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/smoke-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const d = await res.json().catch(() => null)
      if (d && Array.isArray(d.checks)) setSmoke(d as SmokeResult)
      else showFlash('Smoke run returned no results.')
      await load() // refresh events so the last-run marker updates
    } catch {
      showFlash('Could not run the smoke tests.')
    }
    setSmokeRunning(false)
  }

  const counts = {
    critical: events.filter(e => e.severity === 'critical').length,
    error:    events.filter(e => e.severity === 'error').length,
    warn:     events.filter(e => e.severity === 'warn').length,
  }

  // Last persisted smoke run (from the events feed) — shows even before you click Run.
  const lastSmoke = events.find(e => e.event_type === 'smoke_run' || e.event_type === 'smoke_fail')

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>📡 Telemetry</h2>
            <p style={{ fontSize: 13, color: C.textDim }}>
              {view === 'system'
                ? "System — the app's own safety checks firing. Newest first."
                : 'Product — what customers click through and do in the app.'}
            </p>
          </div>
          {view === 'system' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={fireTestError}
                disabled={firing}
                title="Fire a deliberate error through the harness wrapper to verify capture"
                style={{ padding: '7px 13px', borderRadius: 7, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 700, cursor: firing ? 'default' : 'pointer', opacity: firing ? 0.7 : 1 }}
              >
                {firing ? 'Firing…' : '🔥 Fire test error'}
              </button>
              <button
                onClick={load}
                disabled={loading}
                style={{ padding: '7px 13px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}
              >
                {loading ? '↻ …' : '↻ Refresh'}
              </button>
            </div>
          )}
        </div>
        {/* System / Product toggle */}
        <div style={{ display: 'inline-flex', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
          {(['system', 'product'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: view === v ? C.accent : 'transparent', color: view === v ? '#fff' : C.textDim }}
            >
              {v === 'system' ? '🛡 System' : '📊 Product'}
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <div style={{ padding: '9px 14px', background: C.greenDim, border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 12, color: C.green, marginBottom: 16, fontFamily: 'monospace' }}>
          {flash}
        </div>
      )}

      {view === 'product' && <ProductTelemetry />}

      {view === 'system' && <>
      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <Chip label={`Sentry: ${sentry ? 'connected' : 'not configured'}`} color={sentry ? C.green : C.textDim} bg={sentry ? C.greenDim : C.surface2} />
        <Chip label={`${counts.critical} critical`} color="#f472b6" bg="rgba(244,114,182,0.14)" />
        <Chip label={`${counts.error} error`} color={C.red} bg="rgba(239,68,68,0.12)" />
        <Chip label={`${counts.warn} warn`} color={C.amber} bg={C.amberDim} />
      </div>

      {/* Migration-pending banner */}
      {pending && (
        <div style={{ padding: '12px 16px', background: C.amberDim, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 13, color: C.amber, marginBottom: 16 }}>
          ⚠ The <code style={{ fontFamily: 'monospace' }}>harness_events</code> table doesn&apos;t exist yet. Run{' '}
          <code style={{ fontFamily: 'monospace' }}>supabase/migrations/20260707_harness_events.sql</code> in the Supabase SQL editor, then Refresh. Until then events are captured loudly in the server logs but not stored here.
        </div>
      )}

      {err && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 13, color: C.red, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* ── Migrations panel — are any SQL files unrun? ── */}
      {migration && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🗄 Migrations</p>
            {!migration.ledgerReady ? (
              <span style={{ fontSize: 11.5, color: C.amber, fontFamily: 'monospace' }}>ledger not created — run 20260708_applied_migrations.sql</span>
            ) : (migration.pending?.length || migration.orphan?.length) ? (
              <span style={{ fontSize: 11.5, color: C.amber, fontFamily: 'monospace', fontWeight: 700 }}>
                ⚠ {migration.pending?.length || 0} pending{(migration.orphan?.length || 0) > 0 ? `, ${migration.orphan?.length} orphan` : ''}
              </span>
            ) : (
              <span style={{ fontSize: 11.5, color: C.green, fontFamily: 'monospace', fontWeight: 700 }}>✓ all {migration.appliedCount}/{migration.total} applied</span>
            )}
          </div>
          {migration.ledgerReady && !!migration.pending?.length && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Pending — you haven&apos;t run these yet:</p>
              {migration.pending.map(f => (
                <div key={f} style={{ fontSize: 11.5, color: C.amber, fontFamily: 'monospace', padding: '3px 0' }}>• {f}</div>
              ))}
            </div>
          )}
          {migration.ledgerReady && !!migration.orphan?.length && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Orphan — recorded applied but the file is gone:</p>
              {migration.orphan.map(f => (
                <div key={f} style={{ fontSize: 11.5, color: C.textMid, fontFamily: 'monospace', padding: '3px 0' }}>• {f}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Smoke tests panel ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🧪 Smoke tests</p>
            {lastSmoke
              ? <p style={{ fontSize: 11, color: C.textDim, marginTop: 2, fontFamily: 'monospace' }}>
                  Last run: <span style={{ color: lastSmoke.event_type === 'smoke_fail' ? C.red : C.green, fontWeight: 700 }}>{lastSmoke.event_type === 'smoke_fail' ? 'FAIL' : 'PASS'}</span> · {fmtWhen(lastSmoke.created_at)}
                </p>
              : <p style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Never run. Click to verify the critical paths.</p>}
          </div>
          <button
            onClick={runSmoke}
            disabled={smokeRunning}
            style={{ padding: '7px 13px', borderRadius: 7, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 700, cursor: smokeRunning ? 'default' : 'pointer', opacity: smokeRunning ? 0.7 : 1 }}
          >
            {smokeRunning ? 'Running…' : '▶ Run smoke tests'}
          </button>
        </div>
        {smoke && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: smoke.ok ? C.green : C.red, fontFamily: 'monospace', marginBottom: 8 }}>
              {smoke.ok ? '✓ PASS' : '✗ FAIL'} — {smoke.passed}/{smoke.total} checks
            </p>
            {smoke.checks.map(c => (
              <div key={c.name} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 11.5, fontFamily: 'monospace' }}>
                <span style={{ color: c.skipped ? C.textDim : c.ok ? C.green : C.red, flexShrink: 0 }}>{c.skipped ? '–' : c.ok ? '✓' : '✗'}</span>
                <span style={{ color: C.textMid }}>{c.name}</span>
                {c.detail && <span style={{ color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis' }}>— {c.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: C.textDim, padding: '40px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading telemetry…</p>
      ) : events.length === 0 && !pending ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.textDim, border: `2px dashed ${C.border}`, borderRadius: 10 }}>
          <p style={{ fontSize: 14 }}>No harness events recorded. 🎉</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>That&apos;s good — it means nothing has tripped a safety check. Use &quot;Fire test error&quot; to prove capture works.</p>
        </div>
      ) : events.length > 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 90px 1fr', padding: '8px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
            {['When', 'Severity', 'Event'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {events.map((e, i) => {
              const ss = sevStyle(e.severity)
              const isOpen = expandedId === e.id
              return (
                <div key={e.id} style={{ borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div
                    onClick={() => setExpandedId(isOpen ? null : e.id)}
                    style={{ display: 'grid', gridTemplateColumns: '110px 90px 1fr', padding: '10px 16px', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{fmtWhen(e.created_at)}</span>
                    <span>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 10, color: ss.color, background: ss.bg }}>{e.severity}</span>
                    </span>
                    <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11.5, color: C.textMid, fontFamily: 'monospace' }}>
                        {typeLabel(e.event_type)}{e.context ? <span style={{ color: C.textDim }}> · {e.context}</span> : null}
                      </span>
                      <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isOpen ? 'normal' : 'nowrap' }}>{e.message}</span>
                    </span>
                  </div>
                  {isOpen && (e.metadata || e.effective_user_id) && (
                    <div style={{ padding: '0 16px 12px 16px' }}>
                      {e.effective_user_id && (
                        <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', margin: '0 0 6px' }}>user: {e.effective_user_id}</p>
                      )}
                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                        <pre style={{ margin: 0, padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.textMid, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      </>}
    </div>
  )
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, color, background: bg, fontFamily: 'monospace' }}>{label}</span>
  )
}
