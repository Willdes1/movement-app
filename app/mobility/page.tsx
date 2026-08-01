'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import LoopPreview from '@/components/ui/LoopPreview'
import { searchItems, matchesAnyKeyword } from '@/lib/fuzzy-search'

type Exercise = {
  name_normalized: string
  name_display: string
  how: string | null
  tip: string | null
  breathing: string | null
  core: string | null
  // Mobility movements are ordinary exercise_library rows, so they carry the
  // same video columns as everything else. This page just never asked for them,
  // which is why a curated and trimmed mobility video still rendered as text.
  video_url: string | null
  video_source: string | null
  loop_start_sec: number | null
  loop_end_sec: number | null
  youtube_start_sec: number | null
  youtube_end_sec: number | null
}

const AREAS = [
  { label: 'Hip Flexors',  keywords: ['hip flexor', 'psoas', 'hip extension', 'lunge stretch', 'couch stretch'] },
  { label: 'Hamstrings',   keywords: ['hamstring', 'straight leg', 'forward fold', 'hip hinge stretch'] },
  { label: 'Quads',        keywords: ['quad', 'rectus femoris', 'kneeling', 'couch'] },
  { label: 'Glutes',       keywords: ['glute', 'piriformis', 'figure four', 'pigeon', '90 90'] },
  { label: 'T-Spine',      keywords: ['thoracic', 'spine rotation', 'cat cow', 'thread', 'windmill', 'spinal'] },
  { label: 'Shoulders',    keywords: ['shoulder', 'rotator', 'overhead stretch', 'doorway', 'cross body'] },
  { label: 'Chest',        keywords: ['chest stretch', 'pec', 'doorway', 'chest opener'] },
  { label: 'Calves',       keywords: ['calf', 'soleus', 'ankle', 'gastrocnemius', 'wall stretch'] },
  { label: 'Core',         keywords: ['core stretch', 'cobra', 'child pose', 'spinal twist', 'supine'] },
  { label: 'Hips',         keywords: ['hip circle', 'hip opener', 'lateral hip', 'groin', 'adductor', 'butterfly'] },
  { label: 'Neck & Upper', keywords: ['neck', 'upper trap', 'levator', 'cervical', 'chin tuck'] },
  { label: 'Ankles',       keywords: ['ankle', 'dorsiflexion', 'calf raise', 'foot', 'heel'] },
]

export default function MobilityPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    // Load mobility/stretching focused exercises
    // The loop columns may not exist on very old databases, so fall back to a
    // select without them rather than leaving the page blank.
    const COLS_WITH_VIDEO = 'name_normalized, name_display, how, tip, breathing, core, video_url, video_source, loop_start_sec, loop_end_sec, youtube_start_sec, youtube_end_sec'
    const COLS_FALLBACK   = 'name_normalized, name_display, how, tip, breathing, core'
    const areaFilter = [
        'name_normalized.ilike.%stretch%',
        'name_normalized.ilike.%mobility%',
        'name_normalized.ilike.%foam%',
        'name_normalized.ilike.%roll%',
        'name_normalized.ilike.%pose%',
        'name_normalized.ilike.%hold%',
        'name_normalized.ilike.%release%',
        'name_normalized.ilike.%hip_flexor%',
        'name_normalized.ilike.%hamstring%',
        'name_normalized.ilike.%thoracic%',
        'name_normalized.ilike.%pigeon%',
        'name_normalized.ilike.%cobra%',
        'name_normalized.ilike.%child%',
        'name_normalized.ilike.%twist%',
        'name_normalized.ilike.%rotation%',
        'name_normalized.ilike.%flexion%',
        'name_normalized.ilike.%extension%',
    ].join(',')

    const run = (cols: string) => supabase
      .from('exercise_library')
      .select(cols)
      .or(areaFilter)
      .order('name_display', { ascending: true })
      .limit(300)

    run(COLS_WITH_VIDEO).then(async ({ data, error }) => {
      if (error) {
        const { data: fb } = await run(COLS_FALLBACK)
        setExercises((fb ?? []) as unknown as Exercise[])
      } else {
        setExercises((data ?? []) as unknown as Exercise[])
      }
      setLoading(false)
    })
  }, [user])

  const { filtered, suggestions } = useMemo(() => {
    let base = exercises

    if (selectedArea) {
      const area = AREAS.find(a => a.label === selectedArea)
      // Punctuation-blind, so the keyword "cat cow" still finds "Cat-Cow Stretch".
      if (area) base = exercises.filter(e => matchesAnyKeyword(e.name_display, area.keywords))
    }

    const { matches, suggestions } = searchItems(base, query, e => e.name_display)
    return { filtered: matches, suggestions }
  }, [exercises, selectedArea, query])

  function selectArea(label: string) {
    setSelectedArea(prev => prev === label ? null : label)
    setQuery('')
    setExpandedKey(null)
  }

  if (authLoading || loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</div>
  }

  return (
    <div className="page-content" style={{ padding: '24px 16px 100px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Mobility</h1>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>
        Stretching, mobility drills, and recovery movements
      </p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-dim)', pointerEvents: 'none' }}>
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedArea(null) }}
          placeholder="What are you looking to stretch?"
          style={{ width: '100%', padding: '11px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        {(query || selectedArea) && (
          <button
            onClick={() => { setQuery(''); setSelectedArea(null) }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Area chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {AREAS.map(area => {
          const active = selectedArea === area.label
          return (
            <button
              key={area.label}
              onClick={() => selectArea(area.label)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-bg)' : 'var(--surface)',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {area.label}
            </button>
          )
        })}
      </div>

      {/* Result count */}
      {(query || selectedArea) && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, fontWeight: 600 }}>
          {filtered.length} movement{filtered.length !== 1 ? 's' : ''}
          {selectedArea ? ` for ${selectedArea}` : ''}
          {query ? ` matching "${query}"` : ''}
        </p>
      )}

      {/* No filter state */}
      {!query && !selectedArea && (
        <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>
            Pick a body area above or type what&apos;s tight — get targeted stretches and mobility drills instantly.
          </p>
        </div>
      )}

      {/* Exercise list */}
      {(query || selectedArea) && (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No movements found</p>
            {suggestions.length > 0 ? (
              <>
                {/* A near miss should offer a way forward, not a dead end. */}
                <p style={{ fontSize: 13, marginBottom: 12 }}>Did you mean:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {suggestions.map(s => (
                    <button
                      key={s.name_normalized}
                      onClick={() => { setQuery(s.name_display); setExpandedKey(s.name_normalized) }}
                      style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {s.name_display}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13 }}>Try a different area or search term</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(ex => {
              const isOpen = expandedKey === ex.name_normalized
              const hasVideo = !!ex.video_url
              return (
                // A div, not a button: the expanded panel contains a video
                // player, and an iframe cannot legally nest inside a button.
                <div
                  key={ex.name_normalized}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: `1px solid ${isOpen ? 'var(--accent-border)' : 'var(--border)'}`, background: isOpen ? 'var(--accent-bg)' : 'var(--surface)', fontFamily: 'inherit' }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedKey(isOpen ? null : ex.name_normalized)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedKey(isOpen ? null : ex.name_normalized) } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>🧘</span>
                    <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isOpen ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3 }}>
                      {ex.name_display}
                    </p>
                    {hasVideo && (
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 20, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', flexShrink: 0 }}>
                        VIDEO
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Same montage the workout view uses: the trimmed loop
                          when one is saved, with a tap through to the full video. */}
                      <LoopPreview
                        url={ex.video_url}
                        source={ex.video_source}
                        name={ex.name_display}
                        loopStart={ex.loop_start_sec}
                        loopEnd={ex.loop_end_sec}
                        clipStart={ex.youtube_start_sec}
                        clipEnd={ex.youtube_end_sec}
                      />
                      {ex.how && (
                        <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'left' }}>
                          <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>HOW TO DO IT</p>
                          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.how}</p>
                        </div>
                      )}
                      {ex.breathing && (
                        <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'left' }}>
                          <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>BREATHING</p>
                          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.breathing}</p>
                        </div>
                      )}
                      {ex.tip && (
                        <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--accent-border)', textAlign: 'left' }}>
                          <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>COACHING TIP</p>
                          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.tip}</p>
                        </div>
                      )}
                      {!ex.how && !ex.tip && !ex.breathing && (
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '4px 0', textAlign: 'left' }}>
                          Coaching details available once this exercise appears in a generated plan.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
