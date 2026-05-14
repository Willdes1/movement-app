'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

const CATS = [
  { id: 'infrastructure', label: 'Infrastructure', color: C.accent },
  { id: 'design',         label: 'Design',         color: '#ec4899' },
  { id: 'tools',          label: 'Tools & Software', color: C.amber },
  { id: 'marketing',      label: 'Marketing',      color: C.green },
  { id: 'legal',          label: 'Legal',          color: C.red },
  { id: 'other',          label: 'Other',          color: C.textDim },
]

type Expense = {
  id: string; category: string; description: string; amount_usd: number
  vendor: string | null; notes: string | null; receipt_url: string | null
  expense_date: string; created_at: string
}
type TokenRow = { operation: string | null; input_tokens: number | null; output_tokens: number | null }

const INPUT_RATE  = 3 / 1_000_000   // $3 per 1M input tokens
const OUTPUT_RATE = 15 / 1_000_000  // $15 per 1M output tokens

function tokenCost(r: TokenRow) {
  return (r.input_tokens ?? 0) * INPUT_RATE + (r.output_tokens ?? 0) * OUTPUT_RATE
}

function fmtUSD(n: number) {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function thisMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function catCfg(id: string) {
  return CATS.find(c => c.id === id) ?? { label: id, color: C.textDim }
}

function exportCSV(expenses: Expense[], aiRows: TokenRow[]) {
  const aiTotal = aiRows.reduce((s, r) => s + tokenCost(r), 0)
  const lines = [
    'Date,Category,Description,Vendor,Amount USD,Receipt URL,Notes',
    ...expenses.map(e => [
      e.expense_date, e.category, `"${e.description}"`, e.vendor ?? '',
      e.amount_usd.toFixed(2), e.receipt_url ?? '', `"${e.notes ?? ''}"`,
    ].join(',')),
    `${new Date().toISOString().slice(0, 10)},ai,AI / Token Usage (auto-calculated),,${aiTotal.toFixed(4)},,`,
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'project_spend.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function SpendTab() {
  const { user } = useAuth()
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [tokenRows, setTokenRows]   = useState<TokenRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [flash, setFlash]           = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const [fDate, setFDate]     = useState(new Date().toISOString().slice(0, 10))
  const [fCat, setFCat]       = useState('infrastructure')
  const [fDesc, setFDesc]     = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fVendor, setFVendor] = useState('')
  const [fNotes, setFNotes]   = useState('')
  const [fFile, setFFile]     = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: exp }, { data: tok }] = await Promise.all([
      supabase.from('project_expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('token_usage').select('operation, input_tokens, output_tokens'),
    ])
    setExpenses((exp ?? []) as Expense[])
    setTokenRows((tok ?? []) as TokenRow[])
    setLoading(false)
  }

  function showFlash(m: string) { setFlash(m); setTimeout(() => setFlash(''), 3000) }

  function resetForm() {
    setFDate(new Date().toISOString().slice(0, 10))
    setFCat('infrastructure'); setFDesc(''); setFAmount(''); setFVendor(''); setFNotes(''); setFFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit() {
    if (!fDesc.trim() || !fAmount) return
    setSaving(true)
    let receipt_url: string | null = null

    if (fFile) {
      setUploading(true)
      const path = `${Date.now()}-${fFile.name.replace(/\s+/g, '_')}`
      const { data: up, error: upErr } = await supabase.storage.from('receipts').upload(path, fFile, { contentType: fFile.type })
      if (!upErr && up) {
        receipt_url = supabase.storage.from('receipts').getPublicUrl(up.path).data.publicUrl
      }
      setUploading(false)
    }

    const { error } = await supabase.from('project_expenses').insert({
      category: fCat,
      description: fDesc.trim(),
      amount_usd: parseFloat(fAmount),
      vendor: fVendor.trim() || null,
      notes: fNotes.trim() || null,
      receipt_url,
      expense_date: fDate,
      added_by: user?.id,
    })

    if (!error) { resetForm(); setShowForm(false); showFlash('Expense logged.'); await load() }
    else showFlash('Failed to save.')
    setSaving(false)
  }

  async function deleteExpense(id: string) {
    await supabase.from('project_expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    showFlash('Deleted.')
  }

  // ── Computed stats ──
  const aiTotal     = tokenRows.reduce((s, r) => s + tokenCost(r), 0)
  const manualTotal = expenses.reduce((s, e) => s + Number(e.amount_usd), 0)
  const totalSpend  = aiTotal + manualTotal

  const monthStr = thisMonth()
  const monthAI  = tokenRows.filter(r => {
    // token_usage rows don't have created_at here — approximate from expenses
    return true // included in full AI total; monthly AI requires created_at field
  }).reduce(() => 0, 0) // skip monthly AI split (no date on token rows fetched)
  const monthManual = expenses
    .filter(e => e.expense_date.startsWith(monthStr))
    .reduce((s, e) => s + Number(e.amount_usd), 0)

  // Token breakdown by operation
  const opMap = new Map<string, { count: number; input: number; output: number }>()
  for (const r of tokenRows) {
    const key = r.operation ?? 'unknown'
    const cur = opMap.get(key) ?? { count: 0, input: 0, output: 0 }
    opMap.set(key, { count: cur.count + 1, input: cur.input + (r.input_tokens ?? 0), output: cur.output + (r.output_tokens ?? 0) })
  }
  const opStats = [...opMap.entries()]
    .map(([op, s]) => ({ op, ...s, cost: s.input * INPUT_RATE + s.output * OUTPUT_RATE }))
    .sort((a, b) => b.cost - a.cost)

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 7, border: `1px solid ${C.border}`,
    background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: C.textDim, marginBottom: 5, display: 'block',
  }

  if (loading) return <p style={{ fontSize: 13, color: C.textDim, padding: '40px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading spend data…</p>

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Spend Tracker</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>All project costs — AI tokens auto-calculated, manual expenses logged here.</p>
      </div>

      {flash && (
        <div style={{ padding: '9px 14px', background: C.greenDim, border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 12, color: C.green, marginBottom: 16, fontFamily: 'monospace' }}>
          {flash}
        </div>
      )}

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 28 }}>
        {[
          { label: 'Total Project Spend', value: fmtUSD(totalSpend), color: C.text },
          { label: 'AI / Token Costs', value: fmtUSD(aiTotal), color: C.purple },
          { label: 'Manual Expenses', value: fmtUSD(manualTotal), color: C.accent },
          { label: 'This Month (Manual)', value: fmtUSD(monthManual), color: C.amber },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{k.value}</p>
            <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 4 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── AI Token Breakdown ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 12 }}>AI Token Costs — By Operation</p>
        {opStats.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textDim }}>No token usage recorded yet.</p>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 80px', padding: '8px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
              {['Operation', 'Calls', 'Input tok', 'Output tok', 'Cost'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textDim }}>{h}</span>
              ))}
            </div>
            {opStats.map((s, i) => (
              <div key={s.op} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 80px', padding: '10px 16px', borderBottom: i < opStats.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>{s.op}</span>
                <span style={{ fontSize: 12, color: C.textMid, fontFamily: 'monospace' }}>{s.count}</span>
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{s.input.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{s.output.toLocaleString()}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.cost >= 0.01 ? C.purple : C.textDim, fontFamily: 'monospace' }}>{fmtUSD(s.cost)}</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 80px', padding: '10px 16px', background: C.surface2, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total</span>
              <span style={{ fontSize: 12, color: C.textMid, fontFamily: 'monospace' }}>{tokenRows.length}</span>
              <span />
              <span />
              <span style={{ fontSize: 13, fontWeight: 800, color: C.purple, fontFamily: 'monospace' }}>{fmtUSD(aiTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Manual Expenses ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim }}>Manual Expenses</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => exportCSV(expenses, tokenRows)}
              style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}
            >
              ↓ CSV
            </button>
            <button
              onClick={() => { setShowForm(f => !f); resetForm() }}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {showForm ? 'Cancel' : '+ Log Expense'}
            </button>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div style={{ background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Date</label><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Category</label>
                <select value={fCat} onChange={e => setFCat(e.target.value)} style={inp}>
                  {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Description *</label>
              <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="e.g. Vercel Pro plan — May 2026" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Amount (USD) *</label>
                <input type="number" step="0.01" min="0" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" style={inp} />
              </div>
              <div><label style={lbl}>Vendor</label><input value={fVendor} onChange={e => setFVendor(e.target.value)} placeholder="e.g. Vercel" style={inp} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Notes</label>
              <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Optional notes" style={inp} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Receipt Photo</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px dashed ${fFile ? C.green : C.border}`, cursor: 'pointer', background: fFile ? C.greenDim : 'transparent' }}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={e => setFFile(e.target.files?.[0] ?? null)} />
                <span style={{ fontSize: 16 }}>{fFile ? '✓' : '📎'}</span>
                <span style={{ fontSize: 13, color: fFile ? C.green : C.textDim }}>{fFile ? fFile.name : 'Tap to attach receipt (photo or file)'}</span>
              </label>
            </div>
            <button
              onClick={submit}
              disabled={saving || !fDesc.trim() || !fAmount}
              style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: saving || !fDesc.trim() || !fAmount ? C.surface2 : C.accent, color: saving || !fDesc.trim() || !fAmount ? C.textDim : '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {uploading ? 'Uploading receipt…' : saving ? 'Saving…' : 'Save Expense →'}
            </button>
          </div>
        )}

        {/* Expense list */}
        {expenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.textDim, border: `2px dashed ${C.border}`, borderRadius: 10 }}>
            <p style={{ fontSize: 14 }}>No manual expenses logged yet.</p>
            <p style={{ fontSize: 12, marginTop: 6 }}>Click "+ Log Expense" to add your first entry.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {expenses.map(e => {
              const cfg = catCfg(e.category)
              const isOpen = expandedId === e.id
              return (
                <div key={e.id} style={{ background: C.surface, border: `1px solid ${isOpen ? C.accentBorder : C.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <div
                    onClick={() => setExpandedId(isOpen ? null : e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 14, background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35`, flexShrink: 0, fontFamily: 'monospace' }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.amber, fontFamily: 'monospace', flexShrink: 0 }}>{fmtUSD(Number(e.amount_usd))}</span>
                    <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>{fmtDate(e.expense_date)}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {e.vendor && <p style={{ fontSize: 12, color: C.textMid }}><span style={{ color: C.textDim }}>Vendor: </span>{e.vendor}</p>}
                        {e.notes  && <p style={{ fontSize: 12, color: C.textMid }}><span style={{ color: C.textDim }}>Notes: </span>{e.notes}</p>}
                        {e.receipt_url && (
                          <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent }}>📎 View receipt</a>
                        )}
                        <button onClick={() => deleteExpense(e.id)} style={{ alignSelf: 'flex-start', marginTop: 6, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
                Manual total: <span style={{ color: C.amber }}>{fmtUSD(manualTotal)}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
