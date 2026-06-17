'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import LoopPreview from '@/components/ui/LoopPreview'

type ExerciseRow = {
  name_normalized: string
  name_display: string
  video_url: string | null
  video_source: string | null
  youtube_start_sec?: number | null
  youtube_end_sec?: number | null
  loop_start_sec?: number | null
  loop_end_sec?: number | null
}

type ExerciseDetail = ExerciseRow & {
  how: string | null
  breathing: string | null
  core: string | null
  tip: string | null
  youtube_start_sec?: number | null
  youtube_end_sec?: number | null
}

// VideoPlayer + extractYouTubeId moved to components/ui/LoopPreview.tsx + lib/youtube-iframe.ts

function CueRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{value}</p>
    </div>
  )
}

type Filter = 'all' | 'video' | 'no-video'

export default function ExercisesPage() {
  const { isAdmin } = useAuth()
  const [all, setAll]           = useState<ExerciseRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')
  const [filter, setFilter]     = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails]   = useState<Record<string, ExerciseDetail>>({})
  const [fetching, setFetching] = useState<string | null>(null)
  const searchRef               = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      // loop_start_sec/loop_end_sec may not exist yet (migration not run) — fall back gracefully.
      const cols = 'name_normalized, name_display, video_url, video_source, youtube_start_sec, youtube_end_sec'
      const withLoop = await supabase.from('exercise_library').select(`${cols}, loop_start_sec, loop_end_sec`).order('name_display')
      const { data } = withLoop.error
        ? await supabase.from('exercise_library').select(cols).order('name_display')
        : withLoop
      setAll((data ?? []) as ExerciseRow[])
      setLoading(false)
    })()
  }, [])

  async function loadDetail(ex: ExerciseRow) {
    if (details[ex.name_normalized]) return
    setFetching(ex.name_normalized)
    const cols = 'name_normalized, name_display, how, breathing, core, tip, video_url, video_source, youtube_start_sec, youtube_end_sec'
    const withLoop = await supabase.from('exercise_library').select(`${cols}, loop_start_sec, loop_end_sec`).eq('name_normalized', ex.name_normalized).single()
    const { data } = withLoop.error
      ? await supabase.from('exercise_library').select(cols).eq('name_normalized', ex.name_normalized).single()
      : withLoop
    if (data) setDetails(prev => ({ ...prev, [ex.name_normalized]: data as ExerciseDetail }))
    setFetching(null)
  }

  async function toggle(ex: ExerciseRow) {
    if (expanded === ex.name_normalized) {
      setExpanded(null)
      return
    }
    setExpanded(ex.name_normalized)
    await loadDetail(ex)
  }

  const withVideo    = all.filter(e => !!e.video_url).length
  const withoutVideo = all.length - withVideo

  const results = all.filter(e => {
    const matchQ = !query.trim() || e.name_display.toLowerCase().includes(query.toLowerCase())
    const matchF =
      filter === 'all'      ? true :
      filter === 'video'    ? !!e.video_url :
      !e.video_url
    return matchQ && matchF
  })

  const isEmpty = query.trim() === '' && filter === 'all'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 100px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 4 }}>
          Exercise Library
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Search any exercise to view coaching cues and video demonstration.
        </p>
      </div>

      {/* Stats row */}
      {!loading && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Exercises', value: all.length,    color: 'var(--text)' },
            { label: 'With Video',      value: withVideo,     color: 'var(--green)' },
            { label: 'No Video Yet',    value: withoutVideo,  color: 'var(--text-dim)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 100, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-dim)', pointerEvents: 'none' }}>🔍</span>
        <input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises… e.g. 4-7-8 Breathing, Ab Wheel, Squat"
          autoFocus
          style={{
            width: '100%',
            padding: '13px 14px 13px 42px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); searchRef.current?.focus() }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([
          { id: 'all',      label: 'All',          adminOnly: false },
          { id: 'video',    label: '🎬 Has Video', adminOnly: false },
          { id: 'no-video', label: 'No Video Yet', adminOnly: true  },
        ] as { id: Filter; label: string; adminOnly: boolean }[])
        .filter(f => !f.adminOnly || isAdmin)
        .map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              border: `1px solid ${filter === f.id ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f.id ? 'var(--accent-bg)' : 'transparent',
              color: filter === f.id ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 12,
              fontWeight: filter === f.id ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty / loading states */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          Loading exercise library…
        </div>
      )}

      {!loading && isEmpty && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Search the library</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Type an exercise name above, or use the filters to browse.</p>
        </div>
      )}

      {!loading && !isEmpty && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          No exercises match &ldquo;{query}&rdquo;
        </div>
      )}

      {/* Results */}
      {!loading && !isEmpty && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, fontWeight: 600 }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(ex => {
              const isOpen   = expanded === ex.name_normalized
              const detail   = details[ex.name_normalized]
              const isFetch  = fetching === ex.name_normalized
              const hasVideo = !!ex.video_url

              return (
                <div
                  key={ex.name_normalized}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isOpen ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Row */}
                  <button
                    onClick={() => toggle(ex)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 18px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ex.name_display}
                      </span>
                      {hasVideo && (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}>
                          VIDEO
                        </span>
                      )}
                      {!hasVideo && isAdmin && (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                          SOON
                        </span>
                      )}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 18, color: 'var(--text-dim)', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                      ›
                    </span>
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
                      {isFetch ? (
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
                      ) : (
                        <div style={{ paddingTop: 16 }}>
                          <LoopPreview
                            url={detail?.video_url ?? ex.video_url ?? null}
                            source={detail?.video_source ?? ex.video_source ?? null}
                            name={ex.name_display}
                            loopStart={detail?.loop_start_sec ?? ex.loop_start_sec}
                            loopEnd={detail?.loop_end_sec ?? ex.loop_end_sec}
                            clipStart={detail?.youtube_start_sec ?? ex.youtube_start_sec}
                            clipEnd={detail?.youtube_end_sec ?? ex.youtube_end_sec}
                          />
                          <CueRow label="How to perform" value={detail?.how ?? null} />
                          <CueRow label="Breathing"      value={detail?.breathing ?? null} />
                          <CueRow label="Core"           value={detail?.core ?? null} />
                          <CueRow label="Pro tip"        value={detail?.tip ?? null} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
