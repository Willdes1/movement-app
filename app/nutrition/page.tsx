'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { usePlan } from '@/lib/usePlan'
import UpgradeModal from '@/components/UpgradeModal'
import { loadProfile } from '@/lib/storage'
import type { UserProfile } from '@/lib/types'

const DIETARY_OPTIONS = ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo']
const MEALS_OPTIONS = [3, 4, 5, 6]
const IF_OPTIONS = ['None (eat throughout day)', '16:8 (16h fast, 8h eating)', '14:10', '18:6', 'OMAD (one meal a day)']
const HEALTH_CONDITIONS = ['Type 2 Diabetes', 'Gout', 'High Blood Pressure', 'High Cholesterol', 'Lactose Intolerance', 'Gluten Sensitivity', 'IBS / Digestive Issues', 'Carpal Tunnel', 'Thyroid Condition', 'Kidney Issues']

type Meal = { name: string; time: string; description: string; protein: number; carbs: number; fat: number; calories: number }
type Phase = { name: string; calorieNote: string; focus: string; keyFoods: string[] }
type NutritionPlan = {
  summary: string
  dailyCalories: { training: number; rest: number }
  macros: { training: { protein: number; carbs: number; fat: number }; rest: { protein: number; carbs: number; fat: number } }
  phases: Phase[]
  meals: { training: Meal[]; rest: Meal[] }
  hydration: string
  supplements: string[]
  shopping: string[]
  tips: string[]
}

type NutritionSetup = {
  age: string
  weightLbs: string
  heightFt: string
  heightIn: string
  dietaryPref: string
  allergies: string
  mealsPerDay: number
  wakeTime: string
  firstMealTime: string
  ifPref: string
  healthConditions: string[]
}

const PHASE_COLORS: Record<string, string> = {
  'Foundation': 'var(--green)',
  'Build': 'var(--accent)',
  'Peak': 'var(--orange)',
  'Maintenance': 'var(--yellow)',
}

function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9
  const pPct = total ? Math.round((protein * 4 / total) * 100) : 33
  const cPct = total ? Math.round((carbs * 4 / total) * 100) : 33
  const fPct = 100 - pPct - cPct
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
        <div style={{ width: `${pPct}%`, background: '#3b82f6', borderRadius: '4px 0 0 4px' }} />
        <div style={{ width: `${cPct}%`, background: '#f59e0b' }} />
        <div style={{ width: `${fPct}%`, background: '#a78bfa', borderRadius: '0 4px 4px 0' }} />
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
        <span><span style={{ color: '#3b82f6' }}>●</span> Protein {pPct}%</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> Carbs {cPct}%</span>
        <span><span style={{ color: '#a78bfa' }}>●</span> Fat {fPct}%</span>
      </div>
    </div>
  )
}

function MealCard({ meal }: { meal: Meal }) {
  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 1 }}>{meal.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{meal.time}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)' }}>{meal.calories}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>kcal</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 10 }}>{meal.description}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <MacroChip label="P" value={meal.protein} color="#3b82f6" />
        <MacroChip label="C" value={meal.carbs} color="#f59e0b" />
        <MacroChip label="F" value={meal.fat} color="#a78bfa" />
      </div>
    </div>
  )
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: '3px 8px', borderRadius: 6 }}>
      {label} {value}g
    </div>
  )
}

export default function NutritionPage() {
  const { user, loading: authLoading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const router = useRouter()
  const { isPlus, loadingPlan } = usePlan()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const [screen, setScreen] = useState<'loading' | 'setup' | 'plan'>('loading')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [activeDay, setActiveDay] = useState<'training' | 'rest'>('training')
  const [activePhaseIdx, setActivePhaseIdx] = useState(0)

  const [plan, setPlan] = useState<NutritionPlan | null>(null)
  const [setup, setSetup] = useState<NutritionSetup>({
    age: '', weightLbs: '', heightFt: '', heightIn: '', dietaryPref: 'Omnivore', allergies: '', mealsPerDay: 4,
    wakeTime: '', firstMealTime: '', ifPref: 'None (eat throughout day)', healthConditions: [],
  })

  const loadExisting = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('nutrition_plans')
      .select('plan, age, weight_lbs, height_in, dietary_pref, allergies, meals_per_day')
      .eq('user_id', userId)
      .single()
    if (data?.plan) {
      setPlan(data.plan as NutritionPlan)
      setSetup({
        age: data.age?.toString() ?? '',
        weightLbs: data.weight_lbs?.toString() ?? '',
        heightFt: data.height_in ? String(Math.floor(data.height_in / 12)) : '',
        heightIn: data.height_in ? String(data.height_in % 12) : '',
        dietaryPref: data.dietary_pref ?? 'Omnivore',
        allergies: data.allergies ?? '',
        mealsPerDay: data.meals_per_day ?? 4,
        wakeTime: '', firstMealTime: '', ifPref: 'None (eat throughout day)', healthConditions: [],
      })
      setScreen('plan')
    } else {
      setScreen('setup')
    }
  }, [userId])

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && !loadingPlan) loadExisting()
  }, [user, loadingPlan, loadExisting])

  async function generate() {
    if (!user) return
    if (!isPlus) { setShowUpgrade(true); return }

    const heightIn = setup.heightFt || setup.heightIn
      ? (parseInt(setup.heightFt || '0') * 12) + parseInt(setup.heightIn || '0')
      : null

    setGenerating(true)
    setError('')

    const profile = { ...loadProfile(), id: userId } as UserProfile & { id: string }

    try {
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('sport, goal, days_per_week, session_length, training_level, workout_location')
        .eq('id', userId)
        .single()

      const mergedProfile = { ...profile, ...dbProfile, id: userId }

      const res = await fetch('/api/generate-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: mergedProfile,
          nutritionSetup: {
            age: setup.age ? parseInt(setup.age) : null,
            weightLbs: setup.weightLbs ? parseFloat(setup.weightLbs) : null,
            heightIn,
            dietaryPref: setup.dietaryPref,
            allergies: setup.allergies,
            mealsPerDay: setup.mealsPerDay,
            wakeTime: setup.wakeTime || null,
            firstMealTime: setup.firstMealTime || null,
            ifPref: setup.ifPref !== 'None (eat throughout day)' ? setup.ifPref : null,
            healthConditions: setup.healthConditions.length > 0 ? setup.healthConditions : null,
          },
        }),
      })

      const data = await res.json()
      if (!data.plan) { setError('Generation failed. Please try again.'); return }

      setPlan(data.plan)

      await supabase.from('nutrition_plans').upsert({
        user_id: userId,
        plan: data.plan,
        age: setup.age ? parseInt(setup.age) : null,
        weight_lbs: setup.weightLbs ? parseFloat(setup.weightLbs) : null,
        height_in: heightIn,
        dietary_pref: setup.dietaryPref,
        allergies: setup.allergies || null,
        meals_per_day: setup.mealsPerDay,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      setScreen('plan')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (authLoading || loadingPlan || screen === 'loading') return null

  // ── Setup screen ──────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="page-content" style={{ padding: '24px 16px 100px' }}>
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} highlightPlan="plus" />}

        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>Nutrition AI</h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 28 }}>
          Your personalized meal plan — synced to your training phases.
        </p>

        {!isPlus && (
          <div style={{ padding: '16px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>Plus feature</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
              Nutrition AI is included in Plus ($19/mo). Fill out the form below and upgrade when ready.
            </p>
            <button onClick={() => setShowUpgrade(true)} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Upgrade to Plus →
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Body stats */}
          <Section title="Body Stats" sub="Used to calculate your calorie and macro targets">
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label>Age</Label>
                <input value={setup.age} onChange={e => setSetup(s => ({ ...s, age: e.target.value }))} placeholder="e.g. 28" type="number" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Weight (lbs)</Label>
                <input value={setup.weightLbs} onChange={e => setSetup(s => ({ ...s, weightLbs: e.target.value }))} placeholder="e.g. 175" type="number" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Label>Height</Label>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input value={setup.heightFt} onChange={e => setSetup(s => ({ ...s, heightFt: e.target.value }))} placeholder="5" type="number" style={inputStyle} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-dim)' }}>ft</span>
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input value={setup.heightIn} onChange={e => setSetup(s => ({ ...s, heightIn: e.target.value }))} placeholder="10" type="number" style={inputStyle} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-dim)' }}>in</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Diet preferences */}
          <Section title="Dietary Preference">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DIETARY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSetup(s => ({ ...s, dietaryPref: opt }))}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: setup.dietaryPref === opt ? 700 : 400,
                    border: `1px solid ${setup.dietaryPref === opt ? 'var(--accent)' : 'var(--border)'}`,
                    background: setup.dietaryPref === opt ? 'var(--accent-bg)' : 'var(--surface2)',
                    color: setup.dietaryPref === opt ? 'var(--accent)' : 'var(--text-mid)',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Section>

          {/* Allergies */}
          <Section title="Allergies & Restrictions" sub="Optional — anything to avoid completely">
            <textarea
              value={setup.allergies}
              onChange={e => setSetup(s => ({ ...s, allergies: e.target.value }))}
              placeholder="e.g. Dairy, gluten, peanuts, shellfish…"
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </Section>

          {/* Meals per day */}
          <Section title="Meals Per Day">
            <div style={{ display: 'flex', gap: 8 }}>
              {MEALS_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setSetup(s => ({ ...s, mealsPerDay: n }))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, fontSize: 15, fontWeight: setup.mealsPerDay === n ? 900 : 400,
                    border: `1px solid ${setup.mealsPerDay === n ? 'var(--accent)' : 'var(--border)'}`,
                    background: setup.mealsPerDay === n ? 'var(--accent-bg)' : 'var(--surface2)',
                    color: setup.mealsPerDay === n ? 'var(--accent)' : 'var(--text-mid)',
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </Section>

          {/* Meal timing */}
          <Section title="Meal Timing" sub="Optional — helps AI schedule your meals around your day">
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label>Wake time</Label>
                <input value={setup.wakeTime} onChange={e => setSetup(s => ({ ...s, wakeTime: e.target.value }))} placeholder="e.g. 6:30 AM" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>First meal</Label>
                <input value={setup.firstMealTime} onChange={e => setSetup(s => ({ ...s, firstMealTime: e.target.value }))} placeholder="e.g. 7:00 AM" style={inputStyle} />
              </div>
            </div>
          </Section>

          {/* Intermittent fasting */}
          <Section title="Eating Window / Intermittent Fasting">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {IF_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSetup(s => ({ ...s, ifPref: opt }))}
                  style={{
                    padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: setup.ifPref === opt ? 700 : 400,
                    border: `1px solid ${setup.ifPref === opt ? 'var(--accent)' : 'var(--border)'}`,
                    background: setup.ifPref === opt ? 'var(--accent-bg)' : 'var(--surface2)',
                    color: setup.ifPref === opt ? 'var(--accent)' : 'var(--text-mid)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Section>

          {/* Health conditions */}
          <Section title="Health Conditions" sub="Optional — AI adjusts recommendations accordingly">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {HEALTH_CONDITIONS.map(cond => {
                const selected = setup.healthConditions.includes(cond)
                return (
                  <button
                    key={cond}
                    onClick={() => setSetup(s => ({
                      ...s,
                      healthConditions: selected
                        ? s.healthConditions.filter(c => c !== cond)
                        : [...s.healthConditions, cond],
                    }))}
                    style={{
                      padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: selected ? 700 : 400,
                      border: `1px solid ${selected ? 'var(--orange)' : 'var(--border)'}`,
                      background: selected ? 'rgba(255,140,0,0.1)' : 'var(--surface2)',
                      color: selected ? 'var(--orange)' : 'var(--text-mid)',
                      cursor: 'pointer',
                    }}
                  >
                    {selected ? '✓ ' : ''}{cond}
                  </button>
                )
              })}
            </div>
          </Section>

          {error && <p style={{ fontSize: 13, color: 'rgba(255,100,100,0.9)' }}>{error}</p>}

          <button
            onClick={generate}
            disabled={generating}
            style={{
              width: '100%', padding: '15px', borderRadius: 12, border: 'none',
              background: generating ? 'var(--surface2)' : isPlus ? 'var(--accent)' : '#a78bfa',
              color: generating ? 'var(--text-dim)' : '#fff',
              fontWeight: 800, fontSize: 15, cursor: generating ? 'default' : 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {generating ? 'Generating your plan… (30–60 sec)' : isPlus ? 'Generate My Nutrition Plan' : 'Upgrade to Generate'}
          </button>
        </div>
      </div>
    )
  }

  // ── Plan screen ───────────────────────────────────────────────────────────────
  if (!plan) return null

  const dayMacros = plan.macros[activeDay]
  const dayMeals = plan.meals[activeDay] ?? []
  const activePhase = plan.phases[activePhaseIdx]
  const phaseColor = Object.entries(PHASE_COLORS).find(([k]) => activePhase?.name.includes(k))?.[1] ?? 'var(--accent)'

  return (
    <div className="page-content" style={{ padding: '24px 16px 100px' }}>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} highlightPlan="plus" />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>Nutrition Plan</h1>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{setup.dietaryPref} · {setup.mealsPerDay} meals/day</p>
        </div>
        <button
          onClick={() => setScreen('setup')}
          style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '4px 0' }}
        >
          Regenerate
        </button>
      </div>

      {/* Summary */}
      <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{plan.summary}</p>
      </div>

      {/* Calorie + macro overview */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['training', 'rest'] as const).map(day => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: `1px solid ${activeDay === day ? 'var(--accent)' : 'var(--border)'}`,
                background: activeDay === day ? 'var(--accent-bg)' : 'var(--surface2)',
                color: activeDay === day ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {day} Day
            </button>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                {plan.dailyCalories[activeDay].toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginTop: 2 }}>calories / day</div>
            </div>
            <div style={{ display: 'flex', gap: 14, textAlign: 'center' }}>
              <MacroStat label="Protein" value={dayMacros.protein} color="#3b82f6" />
              <MacroStat label="Carbs" value={dayMacros.carbs} color="#f59e0b" />
              <MacroStat label="Fat" value={dayMacros.fat} color="#a78bfa" />
            </div>
          </div>
          <MacroBar protein={dayMacros.protein} carbs={dayMacros.carbs} fat={dayMacros.fat} />
        </div>
      </div>

      {/* Training phases */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Training Phases</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {plan.phases.map((ph, i) => {
            const label = Object.keys(PHASE_COLORS).find(k => ph.name.includes(k)) ?? ph.name
            const color = PHASE_COLORS[label] ?? 'var(--accent)'
            return (
              <button
                key={i}
                onClick={() => setActivePhaseIdx(i)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${activePhaseIdx === i ? color : 'var(--border)'}`,
                  background: activePhaseIdx === i ? `${color}18` : 'var(--surface2)',
                  color: activePhaseIdx === i ? color : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {activePhase && (
          <div style={{ padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${phaseColor}30`, borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: phaseColor, marginBottom: 4 }}>{activePhase.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{activePhase.calorieNote}</div>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 10 }}>{activePhase.focus}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {activePhase.keyFoods.map(f => (
                <span key={f} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: `${phaseColor}15`, color: phaseColor, fontWeight: 600 }}>{f}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meals */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
          {activeDay === 'training' ? 'Training Day' : 'Rest Day'} Meals
        </p>
        {dayMeals.map((meal, i) => <MealCard key={i} meal={meal} />)}
      </div>

      {/* Hydration */}
      <div style={{ padding: '14px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Hydration</p>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>{plan.hydration}</p>
      </div>

      {/* Supplements */}
      {plan.supplements?.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Supplements</p>
          {plan.supplements.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--accent)', fontSize: 12 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Shopping essentials */}
      {plan.shopping?.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Shopping Essentials</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {plan.shopping.map(item => (
              <span key={item} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text-mid)', border: '1px solid var(--border)' }}>{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {plan.tips?.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pro Tips</p>
          {plan.tips.map(tip => (
            <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#f59e0b', fontSize: 12, marginTop: 1, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: sub ? 2 : 10, color: 'var(--text-mid)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}g</div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: 16, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
