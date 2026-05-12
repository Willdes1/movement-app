'use client'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type UserStat = {
  id: string
  name: string | null
  role: string
  is_admin: boolean
  hasProgram: boolean
  exerciseLogs: number
  daysCompleted: number
  lastActive: string | null
}

// Manual MRR config — update these when Stripe is live
const TIER_PRICING: Record<string, { label: string; price: number; color: string }> = {
  free:  { label: 'Free',        price: 0,  color: C.textDim },
  ff:    { label: 'F&F Beta',    price: 0,  color: '#a855f7' },
  beta:  { label: 'Beta Access', price: 0,  color: C.green   },
  admin: { label: 'Admin',       price: 0,  color: C.amber   },
  // pro:   { label: 'Pro',       price: 19, color: C.accent  }, // uncomment when live
}

export default function BillingTab({ users }: { users: UserStat[] }) {
  const tierCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1
    return acc
  }, {})

  const engaged = users.filter(u => u.daysCompleted > 0 || u.exerciseLogs > 0).length
  const withPlan = users.filter(u => u.hasProgram).length
  const activeLast7 = users.filter(u => u.lastActive && (Date.now() - new Date(u.lastActive).getTime()) < 7 * 86400000).length

  const totalUsers = users.length
  const activationRate = totalUsers > 0 ? Math.round((withPlan / totalUsers) * 100) : 0
  const engagementRate = withPlan > 0 ? Math.round((engaged / withPlan) * 100) : 0

  const tiers = Object.keys(TIER_PRICING)
  const mrr = tiers.reduce((sum, t) => sum + (tierCounts[t] ?? 0) * TIER_PRICING[t].price, 0)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Billing Overview</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>Revenue metrics · Stripe integration pending</p>
      </div>

      {/* MRR banner */}
      <div style={{ padding: '24px 28px', background: C.surface, border: `1px solid ${C.accentBorder}`, borderTop: `3px solid ${C.accent}`, borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>Monthly Recurring Revenue</p>
          <p style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.05em', color: mrr > 0 ? C.accent : C.textDim, textShadow: mrr > 0 ? `0 0 30px ${C.accent}40` : 'none' }}>
            ${mrr.toLocaleString()}
          </p>
          <p style={{ fontSize: 12, color: C.textDim, marginTop: 6, fontFamily: 'monospace' }}>
            {mrr === 0 ? 'All users are on free / beta tier · Paid plans launch with Stripe' : `Computed from ${totalUsers} users × tier pricing`}
          </p>
        </div>
        <div style={{ flexShrink: 0, padding: '14px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Next Step</p>
          <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5, maxWidth: 220 }}>Connect Stripe to unlock real-time revenue tracking, subscription management, and churn alerts.</p>
        </div>
      </div>

      {/* Tier breakdown */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Users by Tier</p>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).map(([role, count], i, arr) => {
            const cfg = TIER_PRICING[role] ?? { label: role, price: 0, color: C.textDim }
            const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
            return (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 8px ${cfg.color}80`, flexShrink: 0 }} />
                <div style={{ width: 90, fontSize: 13, fontWeight: 600, color: C.text }}>{cfg.label}</div>
                <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 4, transition: 'width 0.5s ease', boxShadow: `0 0 8px ${cfg.color}60` }} />
                </div>
                <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: C.textMid, fontFamily: 'monospace' }}>
                  <span style={{ fontWeight: 700, color: C.text }}>{count}</span> <span style={{ color: C.textDim }}>({pct}%)</span>
                </div>
                <div style={{ width: 70, textAlign: 'right', fontSize: 11, color: cfg.price > 0 ? C.green : C.textDim, fontFamily: 'monospace' }}>
                  {cfg.price > 0 ? `$${(count * cfg.price).toLocaleString()}/mo` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Engagement metrics */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Platform Health</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Users',       value: totalUsers,         color: C.accent,  sub: 'registered accounts' },
            { label: 'Plan Activation',   value: `${activationRate}%`, color: C.green,   sub: `${withPlan} users have a plan` },
            { label: 'Engagement Rate',   value: `${engagementRate}%`, color: C.purple,  sub: 'of plan holders have logged' },
            { label: 'Active (7d)',        value: activeLast7,         color: C.amber,   sub: 'worked out this week' },
          ].map(m => (
            <div key={m.label} style={{ padding: '18px 20px', background: C.surface, border: `1px solid ${C.border}`, borderTop: `3px solid ${m.color}`, borderRadius: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>{m.label}</p>
              <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: m.color, marginBottom: 4, textShadow: `0 0 16px ${m.color}40` }}>{m.value}</p>
              <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stripe notice */}
      <div style={{ marginTop: 24, padding: '16px 20px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💳</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Stripe Integration — Roadmap</p>
          <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            When Stripe is connected: subscription management, real MRR, trial tracking, failed payments, churn detection, and revenue per user will appear here automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
