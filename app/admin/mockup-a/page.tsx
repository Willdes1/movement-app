'use client'
import { useState } from 'react'

const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#21262d',
  border: '#30363d',
  accent: '#3b82f6',
  accentDim: 'rgba(59,130,246,0.12)',
  accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b',
  amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444',
  purple: '#a78bfa',
  text: '#e6edf3',
  textMid: '#b1bac4',
  textDim: '#6e7681',
}

type NavId = 'overview' | 'users' | 'activity' | 'promos' | 'marketing' | 'partners'

const NAV: { id: NavId; label: string; badge?: number }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users', badge: 12 },
  { id: 'activity', label: 'Activity' },
  { id: 'promos', label: 'Promos' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'partners', label: 'Partners' },
]

const KPIS = [
  { label: 'Total Users', value: '12', sub: '↑ 3 this week', accent: C.accent },
  { label: 'Beta Access', value: '8', sub: '67% of total', accent: C.green },
  { label: 'Active Programs', value: '7', sub: '58% activation', accent: C.accent },
  { label: 'Weeks Generated', value: '23', sub: 'across all users', accent: C.purple },
  { label: 'Days Completed', value: '61', sub: 'total check-ins', accent: C.green },
  { label: 'Exercise Logs', value: '144', sub: 'sets recorded', accent: C.amber },
]

const USERS = [
  { email: 'dentalseowill@gmail.com', name: 'Will D.', role: 'admin', plan: true, weeks: 4, days: 12, logs: 89, joined: 'Apr 1', active: '2h ago' },
  { email: 'mike.t@gmail.com', name: 'Mike T.', role: 'beta', plan: true, weeks: 3, days: 7, logs: 41, joined: 'Apr 15', active: '1d ago' },
  { email: 'jake.m@gmail.com', name: 'Jake M.', role: 'beta', plan: true, weeks: 2, days: 5, logs: 31, joined: 'Apr 20', active: '2h ago' },
  { email: 'sarah.k@gmail.com', name: 'Sarah K.', role: 'beta', plan: true, weeks: 1, days: 3, logs: 24, joined: 'Apr 22', active: '5h ago' },
  { email: 'alex.r@gmail.com', name: 'Alex R.', role: 'free', plan: false, weeks: 0, days: 0, logs: 0, joined: 'Apr 25', active: '2d ago' },
]

const ACTIVITY = [
  { time: 'Just now', user: 'Will D.', event: 'Completed Day 3', detail: 'Week 4 · Build Phase', dot: C.green },
  { time: '2h ago', user: 'Jake M.', event: 'Generated Week 2', detail: 'Foundation Phase', dot: C.accent },
  { time: '5h ago', user: 'Sarah K.', event: 'Redeemed promo', detail: 'MOVE24 → Beta Access', dot: C.amber },
  { time: '8h ago', user: 'Will D.', event: 'Logged set', detail: 'Bench Press · 135 lbs · 3×8', dot: C.purple },
  { time: 'Yesterday', user: 'Will D.', event: 'Generated Week 4', detail: 'Build Phase', dot: C.accent },
  { time: '2d ago', user: 'Alex R.', event: 'Created account', detail: 'Free tier', dot: C.textDim },
]

const PROMOS = [
  { code: 'MOVE24', role: 'beta', used: 3, max: 10, created: 'Apr 10' },
  { code: 'BETA001', role: 'beta', used: 1, max: 5, created: 'Apr 20' },
  { code: 'MVMT2026', role: 'beta', used: 0, max: 20, created: 'Apr 25' },
]

function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    admin: { bg: C.amberDim, color: C.amber },
    beta: { bg: C.greenDim, color: C.green },
    free: { bg: 'rgba(110,118,129,0.1)', color: C.textDim },
  }
  const s = cfg[role] ?? cfg.free
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: s.bg, color: s.color }}>
      {role}
    </span>
  )
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <p style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{label}</p>
      <p style={{ fontSize: 13, color: C.textDim, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>This section is being built out and will be available in the next release.</p>
    </div>
  )
}

// ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────────
function DesktopLayout({ nav, setNav }: { nav: NavId; setNav: (n: NavId) => void }) {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div style={{ display: 'flex', minHeight: '100%', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 14 }}>

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14 }}>Atlas Prime OS</p>
              <p style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Admin Portal</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, padding: '4px 10px 8px' }}>Platform</p>
          {NAV.map(item => {
            const active = nav === item.id
            return (
              <button key={item.id} onClick={() => setNav(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, border: 'none', background: active ? C.accentDim : 'none', color: active ? C.accent : C.textMid, fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer', marginBottom: 2, textAlign: 'left' }}>
                <span>{item.label}</span>
                {item.badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: active ? C.accentBorder : C.surface2, color: active ? C.accent : C.textDim }}>{item.badge}</span>}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={{ fontSize: 11, color: C.textDim }}>All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: C.surface }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{NAV.find(n => n.id === nav)?.label}</span>
            <span style={{ color: C.textDim, margin: '0 8px' }}>·</span>
            <span style={{ fontSize: 12, color: C.textDim }}>{now}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: C.accentDim, border: `1px solid ${C.accentBorder}`, color: C.accent, fontWeight: 700, letterSpacing: '0.06em' }}>ADMIN</span>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>W</div>
          </div>
        </header>

        <div style={{ padding: '28px 28px 60px' }}>
          {nav === 'overview' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Platform Overview</h1>
                <p style={{ fontSize: 13, color: C.textDim }}>Beta · 12 users · Week of Apr 27</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                {KPIS.map(k => (
                  <div key={k.label} style={{ padding: '20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, borderTop: `2px solid ${k.accent}` }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>{k.label}</p>
                    <p style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>{k.value}</p>
                    <p style={{ fontSize: 12, color: k.sub.startsWith('↑') ? C.green : C.textDim }}>{k.sub}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>Recent Activity</p>
                    <button onClick={() => setNav('activity')} style={{ fontSize: 11, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                  </div>
                  {ACTIVITY.slice(0, 5).map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.dot, flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13 }}><strong>{a.user}</strong> — {a.event}</p>
                        <p style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{a.detail}</p>
                      </div>
                      <span style={{ fontSize: 11, color: C.textDim }}>{a.time}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>Users</p>
                    <button onClick={() => setNav('users')} style={{ fontSize: 11, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Manage →</button>
                  </div>
                  {USERS.map((u, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? C.accentDim : C.surface2, border: `1px solid ${u.role === 'admin' ? C.accentBorder : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: u.role === 'admin' ? C.accent : C.textMid, flexShrink: 0 }}>
                        {u.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                        <p style={{ fontSize: 11, color: C.textDim }}>{u.plan ? `${u.weeks}w · ${u.days} days` : 'No plan'}</p>
                      </div>
                      <RoleBadge role={u.role} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {nav === 'users' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Users</h1>
                <p style={{ fontSize: 13, color: C.textDim }}>12 total · 8 beta · 4 free</p>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 80px 80px 80px', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                  {['User', 'Role', 'Plan', 'Weeks', 'Days', 'Logs', 'Joined'].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{h}</span>
                  ))}
                </div>
                {USERS.map((u, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 80px 80px 80px', padding: '14px 20px', borderBottom: i < USERS.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{u.name}</p>
                      <p style={{ fontSize: 11, color: C.textDim }}>{u.email}</p>
                    </div>
                    <RoleBadge role={u.role} />
                    <span style={{ fontSize: 12, color: u.plan ? C.green : C.textDim, fontWeight: u.plan ? 700 : 400 }}>{u.plan ? 'Active' : 'None'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{u.weeks}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{u.days}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{u.logs}</span>
                    <span style={{ fontSize: 12, color: C.textDim }}>{u.joined}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {nav === 'activity' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Live Activity</h1>
                <p style={{ fontSize: 13, color: C.textDim }}>All platform events</p>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {ACTIVITY.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 24px', borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.dot }} />
                      {i < ACTIVITY.length - 1 && <div style={{ width: 1, height: 28, background: C.border, marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14 }}><strong>{a.user}</strong> — {a.event}</p>
                      <p style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{a.detail}</p>
                    </div>
                    <span style={{ fontSize: 12, color: C.textDim }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {nav === 'promos' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Promo Codes</h1>
                <p style={{ fontSize: 13, color: C.textDim }}>Manage beta access distribution</p>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 100px', padding: '10px 24px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                  {['Code', 'Role', 'Usage', 'Created'].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{h}</span>
                  ))}
                </div>
                {PROMOS.map((p, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 100px', padding: '16px 24px', borderBottom: i < PROMOS.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace', fontSize: 14, color: C.accent }}>{p.code}</span>
                    <RoleBadge role={p.role} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 4, background: C.surface2, borderRadius: 2, maxWidth: 120 }}>
                        <div style={{ height: '100%', borderRadius: 2, background: C.accent, width: `${(p.used / p.max) * 100}%` }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.textDim }}>{p.used}/{p.max}</span>
                    </div>
                    <span style={{ fontSize: 12, color: C.textDim }}>{p.created}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {nav === 'marketing' && <ComingSoon label="Marketing Control Panel" />}
          {nav === 'partners' && <ComingSoon label="Partner Management" />}
        </div>
      </main>
    </div>
  )
}

// ─── MOBILE LAYOUT ────────────────────────────────────────────────────────────
function MobileLayout({ nav, setNav }: { nav: NavId; setNav: (n: NavId) => void }) {
  const mobileNav: { id: NavId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '⬡' },
    { id: 'users', label: 'Users', icon: '◯' },
    { id: 'activity', label: 'Activity', icon: '◎' },
    { id: 'promos', label: 'Promos', icon: '◈' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 14, position: 'relative' }}>

      {/* Mobile header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14 }}>Atlas Prime OS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>W</div>
        </div>
      </div>

      {/* Page title */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 2 }}>Admin</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{NAV.find(n => n.id === nav)?.label ?? 'Overview'}</h1>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px' }}>

        {nav === 'overview' && (
          <>
            {/* KPI 2-col grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {KPIS.map(k => (
                <div key={k.label} style={{ padding: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, borderTop: `2px solid ${k.accent}` }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>{k.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 3 }}>{k.value}</p>
                  <p style={{ fontSize: 10, color: k.sub.startsWith('↑') ? C.green : C.textDim }}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: 13 }}>Recent Activity</p>
                <button onClick={() => setNav('activity')} style={{ fontSize: 11, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>All →</button>
              </div>
              {ACTIVITY.slice(0, 4).map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.dot, flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12 }}><strong>{a.user}</strong> — {a.event}</p>
                    <p style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{a.detail}</p>
                  </div>
                  <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {nav === 'users' && (
          <>
            <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>12 total · 8 beta · 4 free</p>
            {USERS.map((u, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.role === 'admin' ? C.accentDim : C.surface2, border: `1px solid ${u.role === 'admin' ? C.accentBorder : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: u.role === 'admin' ? C.accent : C.textMid }}>
                      {u.name[0]}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</p>
                      <p style={{ fontSize: 10, color: C.textDim }}>{u.active}</p>
                    </div>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{u.weeks}</p>
                    <p style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weeks</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{u.days}</p>
                    <p style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Days</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 16, fontWeight: 800 }}>{u.logs}</p>
                    <p style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logs</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: u.plan ? C.green : C.textDim }}>{u.plan ? 'Plan Active' : 'No Plan'}</p>
                    <p style={{ fontSize: 10, color: C.textDim }}>Joined {u.joined}</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {nav === 'activity' && (
          <>
            <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>All platform events</p>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.dot }} />
                    {i < ACTIVITY.length - 1 && <div style={{ width: 1, height: 24, background: C.border, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13 }}><strong>{a.user}</strong> — {a.event}</p>
                    <p style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{a.detail}</p>
                  </div>
                  <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {nav === 'promos' && (
          <>
            <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Manage beta access distribution</p>
            {PROMOS.map((p, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'monospace', fontSize: 15, color: C.accent }}>{p.code}</span>
                  <RoleBadge role={p.role} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: C.surface2, borderRadius: 2 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: C.accent, width: `${(p.used / p.max) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 12, color: C.textDim, flexShrink: 0 }}>{p.used} / {p.max} used</span>
                </div>
                <p style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>Created {p.created}</p>
              </div>
            ))}
          </>
        )}

        {(nav === 'marketing' || nav === 'partners') && <ComingSoon label={NAV.find(n => n.id === nav)?.label ?? ''} />}
      </div>

      {/* Mobile bottom nav */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {mobileNav.map(item => {
          const active = nav === item.id
          return (
            <button key={item.id} onClick={() => setNav(item.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: active ? C.accent : C.textDim, cursor: 'pointer', padding: '8px 0', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── PAGE WRAPPER ─────────────────────────────────────────────────────────────
export default function MockupA() {
  const [nav, setNav] = useState<NavId>('overview')
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')

  return (
    <div style={{ minHeight: '100vh', background: '#000', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Toggle bar */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 4 }}>
        <span style={{ padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>A</span>
        {(['desktop', 'mobile'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: view === v ? '#3b82f6' : 'transparent', color: view === v ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {v === 'desktop' ? '🖥  Desktop' : '📱  Mobile'}
          </button>
        ))}
      </div>

      {view === 'desktop' ? (
        <div style={{ minHeight: '100vh' }}>
          <DesktopLayout nav={nav} setNav={setNav} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '40px 24px' }}>
          {/* Phone frame */}
          <div style={{ width: 390, height: 844, borderRadius: 44, border: '8px solid #1a1a1a', background: C.bg, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', position: 'relative', flexShrink: 0 }}>
            {/* Notch */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 126, height: 34, background: '#1a1a1a', borderRadius: '0 0 18px 18px', zIndex: 10 }} />
            <div style={{ paddingTop: 34, height: '100%', boxSizing: 'border-box' }}>
              <MobileLayout nav={nav} setNav={setNav} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
