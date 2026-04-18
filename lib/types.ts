export type BlockType = 'morning' | 'warmup' | 'workout' | 'abs' | 'cooldown' | 'evening' | 'rest'

export interface Exercise {
  name: string
  meta: string
  tag: string
  svg?: string
  gif?: string | null
  how?: string
  cue?: string
  core?: string
  breathing?: string
  group?: string[]
  intro?: string
}

export interface PhaseVariant {
  label: string
  desc: string
  movements: string[]
}

export interface PhaseBlock {
  type: BlockType
  title: string
  meta: string
  movements?: string[]
  variants?: PhaseVariant[]
}

export interface UserProfile {
  name?: string
  age?: string
  sport?: string
  secondarySports?: string[]
  daysPerWeek?: number
  sessionLength?: string
  goal?: string
  hasRestrictions?: boolean
  restrictionAreas?: string[]
  restrictionNotes?: string
  wantsMorning?: boolean
  wantsEvening?: boolean
  mobilityTime?: string
}
