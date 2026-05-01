'use client'
import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type DayPlan = { day: string; label: string; type: string; movements: string[]; duration: string; focus?: string; coaching?: string }
type Program = { id: string; startDate: string; totalWeeks: number; status: string }

export interface GenerationProgress {
  current: number
  total: number
  details?: boolean
}

export interface GenerationConfig {
  program: Program
  numWeeks: number
  userId: string
  profile: Record<string, unknown>
  onWeekComplete?: (weekNum: number, plan: DayPlan[]) => void
}

interface PlanGenerationContextValue {
  isGenerating: boolean
  progress: GenerationProgress | null
  showDoneNotification: boolean
  startGeneration: (config: GenerationConfig) => void
  dismissDone: () => void
}

const PlanGenerationContext = createContext<PlanGenerationContextValue>({
  isGenerating: false,
  progress: null,
  showDoneNotification: false,
  startGeneration: () => {},
  dismissDone: () => {},
})

function parseExerciseName(m: string) { return m.replace(/\s+\d+[×x]\d+.*$/i, '').replace(/\s+\d+\s+sets?.*$/i, '').trim() }
function normalizeExerciseName(n: string) { return n.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_') }
const REST_MOVEMENTS = new Set(['Full rest', 'Light walk optional', 'Sleep 8+ hours'])

function getPhaseInfo(week: number) {
  if (week <= 4) return { phase: 'foundation', label: 'Foundation Phase', intensity: 'RPE 6-7. Build base fitness and movement quality. Focus on form over load.' }
  if (week <= 8) return { phase: 'build', label: 'Build Phase', intensity: 'RPE 7-8. Increase volume and load progressively each week. Challenge yourself.' }
  if (week <= 10) return { phase: 'peak', label: 'Peak Phase', intensity: 'RPE 9-10. Maximum training stimulus. Push hard — you have earned it.' }
  return { phase: 'maintenance', label: 'Maintenance Phase', intensity: 'RPE 6-7. Reduce volume, lock in gains, stay sharp and engaged.' }
}

function extractDisplayNames(plans: DayPlan[]) {
  return [...new Set(
    plans.filter(d => d.type !== 'rest')
      .flatMap(d => d.movements)
      .map(parseExerciseName)
      .filter(n => n && !REST_MOVEMENTS.has(n))
  )]
}

export function PlanGenerationProvider({ children }: { children: React.ReactNode }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [showDoneNotification, setShowDoneNotification] = useState(false)
  const isRunningRef = useRef(false)

  const startGeneration = useCallback(async (config: GenerationConfig) => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    setIsGenerating(true)
    setShowDoneNotification(false)

    const allPlans: DayPlan[] = []

    for (let w = 1; w <= config.numWeeks; w++) {
      setProgress({ current: w, total: config.numWeeks })
      const { phase, label, intensity } = getPhaseInfo(w)
      try {
        const res = await fetch('/api/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: config.profile, weekNumber: w, phaseLabel: label, intensity, instructions: '' }),
        })
        if (!res.ok) continue
        const { plan, usage } = await res.json()
        await supabase.from('weekly_plans').upsert({ program_id: config.program.id, user_id: config.userId, week_number: w, phase, plan })
        if (usage) {
          const cost = ((usage.input_tokens ?? 0) * 3 + (usage.output_tokens ?? 0) * 15) / 1_000_000
          supabase.from('token_usage').insert({ operation: 'plan_generation', api_route: '/api/generate-plan', input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, estimated_cost_usd: cost, metadata: { week_number: w } })
        }
        allPlans.push(...plan)
        config.onWeekComplete?.(w, plan)
      } catch { /* continue to next week */ }
    }

    // Populate exercise library for all exercises in the generated plan
    setProgress({ current: config.numWeeks, total: config.numWeeks, details: true })
    const displayNames = extractDisplayNames(allPlans)
    if (displayNames.length > 0) {
      const { data: existing } = await supabase.from('exercise_library').select('name_normalized')
      const existingSet = new Set(existing?.map(e => e.name_normalized) ?? [])
      const missing = [...new Set(displayNames.filter(n => !existingSet.has(normalizeExerciseName(n))))]
      const BATCH = 15
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH)
        try {
          const res = await fetch('/api/generate-exercise-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exercises: batch }),
          })
          if (res.ok) {
            const { details, usage } = await res.json()
            if (Array.isArray(details) && details.length > 0) {
              await supabase.from('exercise_library').upsert(details, { onConflict: 'name_normalized' })
            }
            if (usage) {
              const cost = ((usage.input_tokens ?? 0) * 3 + (usage.output_tokens ?? 0) * 15) / 1_000_000
              supabase.from('token_usage').insert({ operation: 'exercise_details', api_route: '/api/generate-exercise-details', input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, estimated_cost_usd: cost, metadata: { exercise_count: batch.length } })
            }
          }
        } catch { /* continue */ }
      }
    }

    setProgress(null)
    setIsGenerating(false)
    setShowDoneNotification(true)
    isRunningRef.current = false
  }, [])

  const dismissDone = useCallback(() => setShowDoneNotification(false), [])

  return (
    <PlanGenerationContext.Provider value={{ isGenerating, progress, showDoneNotification, startGeneration, dismissDone }}>
      {children}
    </PlanGenerationContext.Provider>
  )
}

export function usePlanGeneration() {
  return useContext(PlanGenerationContext)
}
