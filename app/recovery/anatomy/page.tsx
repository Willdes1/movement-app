'use client'
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Exercise = {
  name_normalized: string
  name_display: string
  how: string | null
  tip: string | null
  breathing: string | null
}

const MUSCLE_GROUPS = [
  { label: 'Chest',      icon: '🫁', keywords: ['chest', 'pec', 'bench', 'fly', 'push up'] },
  { label: 'Back',       icon: '🔙', keywords: ['back', 'row', 'pull', 'lat', 'deadlift', 'rhomboid', 'trap'] },
  { label: 'Shoulders',  icon: '💪', keywords: ['shoulder', 'overhead', 'press', 'lateral raise', 'rotator', 'delt'] },
  { label: 'Biceps',     icon: '💪', keywords: ['bicep', 'curl', 'hammer', 'chin up'] },
  { label: 'Triceps',    icon: '🦾', keywords: ['tricep', 'pushdown', 'extension', 'dip', 'skull'] },
  { label: 'Core',       icon: '⚡', keywords: ['core', 'plank', 'crunch', 'ab', 'oblique', 'hollow', 'dead bug'] },
  { label: 'Hips',       icon: '🦴', keywords: ['hip', 'glute', 'piriformis', 'abductor', 'adductor', 'pigeon', '90 90'] },
  { label: 'Quads',      icon: '🦵', keywords: ['quad', 'squat', 'lunge', 'leg press', 'extension', 'step up'] },
  { label: 'Hamstrings', icon: '🦵', keywords: ['hamstring', 'deadlift', 'leg curl', 'nordic', 'hip hinge'] },
  { label: 'Calves',     icon: '🦶', keywords: ['calf', 'soleus', 'ankle', 'raise', 'gastrocnemius'] },
  { label: 'Knees',      icon: '🦿', keywords: ['knee', 'terminal extension', 'VMO', 'patellar', 'quad set'] },
  { label: 'Ankles',     icon: '🦶', keywords: ['ankle', 'dorsiflexion', 'plantar', 'banded', 'calf stretch'] },
]

export default function AnatomyExplorerPage() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [libLoaded, setLibLoaded] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!user || libLoaded) return
    supabase
      .from('exercise_library')
      .select('name_normalized, name_display, how, tip, breathing')
      .order('name_display', { ascending: true })
      .limit(800)
      .then(({ data }) => {
        setExercises((data ?? []) as Exercise[])
        setLibLoaded(true)
      })
  }, [user, libLoaded])

  const filtered = useMemo(() => {
    if (!selectedGroup) return []
    const group = MUSCLE_GROUPS.find(g => g.label === selectedGroup)
    if (!group) return []
    return exercises.filter(e => {
      const name = e.name_display.toLowerCase()
      return group.keywords.some(kw => name.includes(kw))
    }).slice(0, 20)
  }, [exercises, selectedGroup])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Anatomy iframe — fixed height, not full-screen */}
      <div style={{ height: '55vh', minHeight: 300, maxHeight: 480, flexShrink: 0, background: '#020208', position: 'relative' }}>
        <iframe
          src="/anatomy-explorer.html"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Anatomy Explorer — Move."
        />
      </div>

      {/* Targeted exercises section */}
      <div style={{ flex: 1, padding: '20px 16px 100px', maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Targeted Exercises</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          Pick a muscle group to browse exercises, stretches, and mobility drills.
        </p>

        {/* Muscle group chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {MUSCLE_GROUPS.map(group => {
            const active = selectedGroup === group.label
            return (
              <button
                key={group.label}
                onClick={() => { setSelectedGroup(prev => prev === group.label ? null : group.label); setExpandedKey(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-bg)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 14 }}>{group.icon}</span>
                {group.label}
              </button>
            )
          })}
        </div>

        {/* Results */}
        {selectedGroup && (
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)' }}>
              <p style={{ fontSize: 14, marginBottom: 4 }}>No exercises found for {selectedGroup}</p>
              <p style={{ fontSize: 12 }}>More exercises will appear as your library grows.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                {filtered.length} exercise{filtered.length !== 1 ? 's' : ''} for {selectedGroup}
              </p>
              {filtered.map(ex => {
                const isOpen = expandedKey === ex.name_normalized
                return (
                  <button
                    key={ex.name_normalized}
                    onClick={() => setExpandedKey(isOpen ? null : ex.name_normalized)}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: `1px solid ${isOpen ? 'var(--accent-border)' : 'var(--border)'}`, background: isOpen ? 'var(--accent-bg)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isOpen ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3 }}>
                        {ex.name_display}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', flexShrink: 0 }}>▶</span>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        {!ex.how && !ex.tip && (
                          <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '4px 0', textAlign: 'left' }}>
                            Coaching details available once this exercise appears in a generated plan.
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        )}

        {!selectedGroup && (
          <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>
              Select a muscle group above to see targeted exercises, stretches, and mobility drills from your exercise library.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
