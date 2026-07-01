'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export type CoachDay = {
  day: string
  label: string
  type: string
  movements: string[]
  focus: string
  duration: string
  walkthrough_url?: string | null
}

export type CoachWeek = {
  id: string
  week_number: number
  label: string
  phase: string | null
  days: CoachDay[]
  coach_notes: string
}

export type CoachProgram = {
  id: string
  name: string
  weeks_total: number
  notes: string | null
  description: string | null
}

export type CoachAssignment = {
  id: string
  start_date: string
  status: string
}

// One entry of the coach's personal library, keyed by normalized exercise name.
export type CoachLibEntry = {
  name: string
  instructions: string | null
  notes: string | null
  how: string | null
  breathing: string | null
  core: string | null
  tip: string | null
  custom_fields: { label: string; text: string }[] | null
  sets_reps: string | null
  video_type: 'youtube' | 'shorts' | 'upload' | null
  youtube_url: string | null
  youtube_start_sec: number | null
  youtube_end_sec: number | null
  video_url: string | null
}

export type EndedAssignment = {
  id: string
  status: string
  programName: string | null
  coachName: string
}

export type PendingAssignment = {
  id: string
  programName: string | null
  coachName: string
  startDate: string
}

type CoachedContextType = {
  coached: boolean
  loading: boolean
  coachName: string
  coachId: string | null
  assignment: CoachAssignment | null
  program: CoachProgram | null
  weeks: CoachWeek[]
  coachLibrary: Record<string, CoachLibEntry>
  coachVoiceReady: boolean
  endedAssignment: EndedAssignment | null
  pendingAssignment: PendingAssignment | null
  refresh: () => void
}

const CoachedContext = createContext<CoachedContextType>({
  coached: false,
  loading: true,
  coachName: '',
  coachId: null,
  assignment: null,
  program: null,
  weeks: [],
  coachLibrary: {},
  coachVoiceReady: false,
  endedAssignment: null,
  pendingAssignment: null,
  refresh: () => {},
})

export function CoachedProvider({ children }: { children: React.ReactNode }) {
  const { user, effectiveUserId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [coachName, setCoachName] = useState('')
  const [coachId, setCoachId] = useState<string | null>(null)
  const [assignment, setAssignment] = useState<CoachAssignment | null>(null)
  const [program, setProgram] = useState<CoachProgram | null>(null)
  const [weeks, setWeeks] = useState<CoachWeek[]>([])
  const [coachLibrary, setCoachLibrary] = useState<Record<string, CoachLibEntry>>({})
  const [coachVoiceReady, setCoachVoiceReady] = useState(false)
  const [endedAssignment, setEndedAssignment] = useState<EndedAssignment | null>(null)
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null)

  const load = useCallback(async () => {
    if (!user || !effectiveUserId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // During Zoom In, ask the API for the impersonated user's assignment
      const qs = effectiveUserId !== user.id ? `?userId=${effectiveUserId}` : ''
      const res = await fetch(`/api/coach/my-program${qs}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.assignment) {
        setAssignment(data.assignment)
        setProgram(data.program)
        setWeeks(data.weeks ?? [])
        setCoachName(data.coachName ?? '')
        setCoachId(data.coachId ?? null)
        setCoachLibrary(data.coachLibrary ?? {})
        setCoachVoiceReady(data.coachVoiceReady === true)
        setEndedAssignment(null)
        setPendingAssignment(data.pendingAssignment ?? null)
      } else {
        setAssignment(null); setProgram(null); setWeeks([]); setCoachName(''); setCoachId(null); setCoachLibrary({}); setCoachVoiceReady(false)
        setEndedAssignment(data.endedAssignment ?? null)
        setPendingAssignment(data.pendingAssignment ?? null)
      }
    } catch {
      // network failure — treat as not coached rather than blocking the app
      setAssignment(null)
    } finally {
      setLoading(false)
    }
  }, [user, effectiveUserId])

  useEffect(() => { load() }, [load])

  return (
    <CoachedContext.Provider value={{
      coached: !!assignment && !!program,
      loading, coachName, coachId, assignment, program, weeks, coachLibrary, coachVoiceReady, endedAssignment, pendingAssignment,
      refresh: load,
    }}>
      {children}
    </CoachedContext.Provider>
  )
}

export function useCoached() {
  return useContext(CoachedContext)
}
