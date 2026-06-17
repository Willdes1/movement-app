// Shared YouTube IFrame Player API loader + minimal types.
// Used by the admin loop trimmer and the user-facing LoopPreview so the segment-loop
// logic lives in one place. The API script is injected exactly once per page.

export interface YTPlayer {
  getDuration(): number
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead?: boolean): void
  playVideo(): void
  pauseVideo(): void
  mute(): void
  destroy(): void
}
export interface YTPlayerCtorOptions {
  videoId: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: number; target: YTPlayer }) => void
  }
}
export interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerCtorOptions) => YTPlayer
  PlayerState: { ENDED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

export function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

export function extractYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null
}

// ── Concurrent-player budget ──────────────────────────────────────────────────
// Each live YouTube IFrame player is heavy on mobile. Cap how many auto-loop
// previews play at once; off-screen/over-budget previews show a static poster
// until a slot frees. Lazy mounting (IntersectionObserver) keeps it to the
// viewport; this is the hard ceiling on top of that.
const MAX_ACTIVE_PLAYERS = 4
let activePlayers = 0
const slotWaiters = new Set<() => void>()

export function acquirePlayerSlot(): boolean {
  if (activePlayers < MAX_ACTIVE_PLAYERS) { activePlayers++; return true }
  return false
}
export function releasePlayerSlot() {
  if (activePlayers > 0) activePlayers--
  const next = slotWaiters.values().next().value
  if (next) { slotWaiters.delete(next); next() }
}
// Register to be notified when a slot frees up. Returns an unsubscribe fn.
export function onPlayerSlotAvailable(cb: () => void): () => void {
  slotWaiters.add(cb)
  return () => slotWaiters.delete(cb)
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
