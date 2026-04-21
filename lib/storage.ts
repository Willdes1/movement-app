'use client'

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch {}
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key) } catch {}
}

// Set tracking
export function trackerKey(phase: number, variant: number, movement: string, field: string) {
  return `mv_p${phase}_v${variant}_${movement}_${field}`
}
export function getSetDone(phase: number, variant: number, movement: string, setIdx: number): boolean {
  return safeGet(trackerKey(phase, variant, movement, `s${setIdx}`)) === '1'
}
export function setSetDone(phase: number, variant: number, movement: string, setIdx: number, done: boolean) {
  safeSet(trackerKey(phase, variant, movement, `s${setIdx}`), done ? '1' : '0')
}
export function getWeight(phase: number, variant: number, movement: string): string {
  return safeGet(trackerKey(phase, variant, movement, 'w')) ?? ''
}
export function setWeight(phase: number, variant: number, movement: string, val: string) {
  safeSet(trackerKey(phase, variant, movement, 'w'), val)
}
export function resetVariant(phase: number, variant: number, movements: string[]) {
  movements.forEach(mv => {
    for (let i = 0; i < 10; i++) safeRemove(trackerKey(phase, variant, mv, `s${i}`))
    safeRemove(trackerKey(phase, variant, mv, 'w'))
  })
}

// Profile
export function saveProfile(profile: object) {
  safeSet('mv_profile', JSON.stringify(profile))
}
export function loadProfile(): object | null {
  const raw = safeGet('mv_profile')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// Gate checks
export function getGateChecks(): boolean[] {
  const raw = safeGet('mv_gate')
  if (!raw) return [false, false, false, false]
  try { return JSON.parse(raw) } catch { return [false, false, false, false] }
}
export function setGateChecks(checks: boolean[]) {
  safeSet('mv_gate', JSON.stringify(checks))
}

// Active recovery tracking
export type ActiveRecovery = { playbook: string; phase: number }
export function getActiveRecovery(): ActiveRecovery | null {
  const raw = safeGet('mv_active_recovery')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
export function setActiveRecovery(recovery: ActiveRecovery) {
  safeSet('mv_active_recovery', JSON.stringify(recovery))
}
export function clearActiveRecovery() {
  safeRemove('mv_active_recovery')
}
