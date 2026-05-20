'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  purple: '#a78bfa', purpleDim: 'rgba(167,139,250,0.1)',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type PlanRow = {
  id: string
  name: string | null
  email: string | null
  plan: string | null
  stripe_customer_id: string | null
  updated_at: string
}

const PLAN_STYLE: Record<string, { color: string; bg: string }> = {
  pro:     { color: C.accent,  bg: 'rgba(59,130,246,0.1)' },
  plus:    { color: C.purple,  bg: C.purpleDim },
  supreme: { color: C.amber,   bg: C.amberDim },
  free:    { color: C.textDim, bg: 'rgba(110,118,129,0.08)' },
}

const PLAN_PRICES: Record<string, number> = { pro: 12, plus: 19, supreme: 29 }

export default function StripeTab() {
  const [rows, setRows] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, plan, stripe_customer_id, updated_at')
      .order('updated_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return }
        // Fetch emails from auth.users via admin API isn't available client-side;
        // join with email from profiles if stored, otherwise leave blank
        setRows(data.map(r => ({ ...r, email: null })))
        setLoading(false)
      })
  }, [])

  const paid = rows.filter(r => r.plan && r.plan !== 'free' && r.plan !== null)
  const mrr = paid.reduce((sum, r) => sum + (PLAN_PRICES[r.plan!] ?? 0), 0)

  const counts: Record<string, number> = {}
  for (const r of rows) {
    const p = r.plan ?? 'free'
    counts[p] = (counts[p] ?? 0) + 1
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 860 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Stripe Billing</h2>
      <p style={{ fontSize: 13, color: C.textDim, marginBottom: 24 }}>
        Subscription overview — live plan data from Supabase (updated via webhooks)
      </p>

      {/* MRR + tier counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard label="MRR" value={`$${mrr}`} sub={`${paid.length} paid user${paid.length !== 1 ? 's' : ''}`} color={C.green} />
        <StatCard label="ARR (est.)" value={`$${mrr * 12}`} sub="monthly × 12" color={C.accent} />
        <StatCard label="Pro" value={String(counts.pro ?? 0)} sub="$12/mo" color={C.accent} />
        <StatCard label="Plus" value={String(counts.plus ?? 0)} sub="$19/mo" color={C.purple} />
        <StatCard label="Supreme" value={String(counts.supreme ?? 0)} sub="$29/mo" color={C.amber} />
        <StatCard label="Free" value={String(counts.free ?? rows.filter(r => !r.plan || r.plan === 'free').length)} sub="no subscription" color={C.textDim} />
      </div>

      {/* Setup checklist */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.textMid, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
          Setup Checklist
        </p>
        {[
          { label: 'Add STRIPE_SECRET_KEY to Vercel', done: false },
          { label: 'Add STRIPE_WEBHOOK_SECRET to Vercel', done: false },
          { label: 'Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to Vercel', done: false },
          { label: 'Add STRIPE_PRO_PRICE_ID to Vercel', done: false },
          { label: 'Add STRIPE_PLUS_PRICE_ID to Vercel', done: false },
          { label: 'Add STRIPE_SUPREME_PRICE_ID to Vercel', done: false },
          { label: 'Run Supabase SQL: add stripe_customer_id + plan to profiles', done: false },
          { label: 'Register webhook endpoint in Stripe dashboard → /api/stripe/webhook', done: false },
          { label: 'Create 3 Products in Stripe: Pro $12, Plus $19, Supreme $29/mo', done: false },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: item.done ? C.green : C.textDim, marginTop: 1, flexShrink: 0 }}>
              {item.done ? '✓' : '○'}
            </span>
            <span style={{ fontSize: 13, color: item.done ? C.textMid : C.text, textDecoration: item.done ? 'line-through' : 'none' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Subscriber list */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMid }}>All Users by Plan</span>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textDim, fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textDim, fontSize: 13 }}>No users yet</div>
        ) : (
          <div>
            {rows.map((row, i) => {
              const planKey = row.plan ?? 'free'
              const style = PLAN_STYLE[planKey] ?? PLAN_STYLE.free
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.name ?? 'Unnamed User'}
                    </div>
                    {row.stripe_customer_id && (
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
                        {row.stripe_customer_id}
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: style.bg, color: style.color,
                    flexShrink: 0,
                  }}>
                    {planKey}
                  </span>
                  {planKey !== 'free' && (
                    <span style={{ fontSize: 12, color: C.textDim, flexShrink: 0 }}>
                      ${PLAN_PRICES[planKey]}/mo
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textDim }}>{sub}</div>
    </div>
  )
}
