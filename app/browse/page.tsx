'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Exercise = {
  name_normalized: string
  name_display: string
  how: string | null
  tip: string | null
  breathing: string | null
  core: string | null
  video_url: string | null
  tts_url_male: string | null
  tts_url_female: string | null
}

export default function BrowsePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from('exercise_library')
      .select('name_normalized, name_display, how, tip, breathing, core, video_url, tts_url_male, tts_url_female')
      .order('name_display', { ascending: true })
      .then(({ data }) => {
        setExercises((data ?? []) as Exercise[])
        setLoading(false)
      })
  }, [user])

  const filtered = useMemo(() => {
    if (!query.trim()) return exercises
    const q = query.toLowerCase()
    return exercises.filter(e => e.name_display.toLowerCase().includes(q))
  }, [exercises, query])

  const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  // Reset page when search changes
  useEffect(() => { setPage(0) }, [query])

  if (authLoading || loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Browse & Learn</h1>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>
        {exercises.length.toLocaleString()} exercises in the library
      </p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-dim)', pointerEvents: 'none' }}>
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises…"
          style={{ width: '100%', padding: '11px 14px 11px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Quick stats */}
      {!query && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Recovery', count: exercises.filter(e => e.name_normalized.includes('stretch') || e.name_normalized.includes('mobility') || e.name_normalized.includes('foam')).length, color: 'var(--green)' },
            { label: 'With Video', count: exercises.filter(e => e.video_url).length, color: 'var(--accent)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</p>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results count */}
      {query && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, fontWeight: 600 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{query}&quot;
        </p>
      )}

      {/* Exercise list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No exercises found</p>
          <p style={{ fontSize: 13 }}>Try a different search term</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {paginated.map(ex => (
            <button
              key={ex.name_normalized}
              onClick={() => setSelected(selected?.name_normalized === ex.name_normalized ? null : ex)}
              style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: `1px solid ${selected?.name_normalized === ex.name_normalized ? 'var(--accent-border)' : 'var(--border)'}`, background: selected?.name_normalized === ex.name_normalized ? 'var(--accent-bg)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: selected?.name_normalized === ex.name_normalized ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3 }}>
                  {ex.name_display}
                </p>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {ex.video_url && <span style={{ fontSize: 10, color: 'var(--accent)' }}>▶</span>}
                  {ex.how && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>📝</span>}
                </div>
              </div>
              {selected?.name_normalized === ex.name_normalized && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ex.how && (
                    <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>HOW TO DO IT</p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.how}</p>
                    </div>
                  )}
                  {ex.breathing && (
                    <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>BREATHING</p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.breathing}</p>
                    </div>
                  )}
                  {ex.tip && (
                    <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--accent-border)' }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>COACHING TIP</p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.tip}</p>
                    </div>
                  )}
                  {!ex.how && !ex.tip && (
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '8px 0' }}>
                      Coaching details will appear when this exercise is included in a generated plan.
                    </p>
                  )}
                </div>
              )}
            </button>
          ))}

          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              style={{ marginTop: 8, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Load more ({filtered.length - paginated.length} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
