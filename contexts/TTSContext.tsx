'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// One audio element for the whole app.
//
// Before this provider each surface called useTTS() separately, so each got its
// own Audio object: a tap in a workout block and a tap in the coached card
// played over the top of each other, and stop() only ever stopped the instance
// you were looking at. Everything now runs through a single element held here.

export type TTSGender = 'male' | 'female'

export type SpeakOpts = {
  /** Identity of the thing being read, so the UI can show which row is live. */
  key?: string
  /** Human name for the mini player, e.g. the exercise display name. */
  label?: string
  /** Skip the API entirely and play this pre-generated file. */
  preGeneratedUrl?: string
  /**
   * Exercise slug. Passing this lets the server save the audio onto the
   * exercise_library row. NEVER pass it for a partial read (a single section),
   * or the row's full-narration file gets overwritten with a fragment.
   */
  nameNormalized?: string
  /** Play only this window of the clip. See SpeakItem.slice. */
  slice?: { start: number; end: number }
}

export type SpeakItem = {
  text: string
  preGeneratedUrl?: string
  nameNormalized?: string
  /**
   * Play only part of the resolved clip, as fractions of its length.
   * This is how a single instruction section gets read without generating a
   * second file: the whole narration is already one MP3, so reading one section
   * is a seek into audio we have paid for, not a new request.
   */
  slice?: { start: number; end: number }
}

// A section boundary is estimated from character position, so it can land a
// beat early or late. Widening the window either side means the listener hears
// a little of the neighbouring sentence rather than losing their own.
const SLICE_LEAD_IN = 0.3
const SLICE_TAIL = 0.25

export const TTS_SPEEDS = [0.75, 1, 1.25, 1.5] as const

type TTSValue = {
  /** Read one piece of text. */
  speak: (text: string, opts?: SpeakOpts) => Promise<void>
  /** Read a list back to back, advancing automatically. */
  speakQueue: (items: SpeakItem[], opts?: SpeakOpts) => Promise<void>
  /** Start, or stop if this key is already the live one. */
  toggle: (key: string, items: SpeakItem[] | string, opts?: SpeakOpts) => Promise<void>
  stop: () => void
  /**
   * Stop only if `key` is playing, or anything namespaced under it
   * ("exercise:squat" also matches "exercise:squat:breathing").
   * Safe to call on unmount.
   */
  stopIf: (key: string) => void
  pause: () => void
  resume: () => void

  /** True from the moment playback begins until `ended` or stop. */
  speaking: boolean
  paused: boolean
  loading: boolean
  /** Which key is live (loading or speaking), or null. */
  activeKey: string | null
  /** What is playing, for the mini player. */
  activeLabel: string | null
  /** Index into the current queue, or -1. */
  sectionIndex: number
  queueLength: number
  /** Jump within the current clip. 0 to 1. */
  seek: (fraction: number) => void

  gender: TTSGender
  toggleGender: () => void
  setGender: (g: TTSGender) => void
  speed: number
  setSpeed: (s: number) => void
}

const TTSContext = createContext<TTSValue | null>(null)

// Playback position ticks several times a second. It lives in its own context so
// that only the components drawing a progress bar re-render at that rate, not
// every page that happens to own a speaker button.
type TTSProgressValue = { progress: number; elapsed: number; duration: number }
const TTSProgressContext = createContext<TTSProgressValue>({ progress: 0, elapsed: 0, duration: 0 })

// Session cache of blob URLs, bounded so a long session cannot leak memory.
// Evicted entries get revoked; entries still in the map stay reusable.
const MAX_CACHED_CLIPS = 24
const audioCache = new Map<string, string>()

function cacheGet(key: string): string | undefined {
  const url = audioCache.get(key)
  if (url) {
    // Refresh recency.
    audioCache.delete(key)
    audioCache.set(key, url)
  }
  return url
}

// `inUse` is whatever the audio element currently points at. Evicting and
// revoking the clip that is playing would be a self-inflicted bug, so it gets
// skipped and the next-oldest goes instead.
function cacheSet(key: string, url: string, inUse?: string) {
  if (audioCache.size >= MAX_CACHED_CLIPS) {
    for (const oldest of audioCache.keys()) {
      const stale = audioCache.get(oldest)
      if (stale === inUse) continue
      audioCache.delete(oldest)
      if (stale) URL.revokeObjectURL(stale)
      break
    }
  }
  audioCache.set(key, url)
}

// Hash the whole string. The old cache key was an 80-character prefix, so two
// exercises whose name and opening sentence matched shared one clip.
function hashText(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${h.toString(36)}_${text.length}`
}

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [sectionIndex, setSectionIndex] = useState(-1)
  const [queueLength, setQueueLength] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  // Active slice in seconds, so progress can be reported relative to the
  // section being played rather than to the whole file.
  const [slice, setSlice] = useState<{ start: number; end: number } | null>(null)

  const [gender, setGenderState] = useState<TTSGender>('male')
  const [speed, setSpeedState] = useState(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Mirrors activeKey so toggle/stopIf read the live value, not a render-stale one.
  const activeKeyRef = useRef<string | null>(null)
  const queueRef = useRef<SpeakItem[]>([])
  const queueIdxRef = useRef(-1)
  const speedRef = useRef(1)
  const genderRef = useRef<TTSGender>('male')
  // Second at which the current slice should stop, and the callback that runs
  // when a clip finishes. Both are read by the shared timeupdate handler.
  const sliceEndRef = useRef<number | null>(null)
  const finishRef = useRef<(() => void) | null>(null)
  // Bumped on every stop or new request. Any in-flight work whose token no
  // longer matches throws its result away, so a response that lands after you
  // navigated away or tapped something else can never start playing.
  const tokenRef = useRef(0)

  // Preferences load client-side to keep the server render stable.
  useEffect(() => {
    const g = localStorage.getItem('tts_gender') as TTSGender | null
    if (g === 'male' || g === 'female') { setGenderState(g); genderRef.current = g }
    const s = Number(localStorage.getItem('tts_speed'))
    if (s && TTS_SPEEDS.includes(s as typeof TTS_SPEEDS[number])) { setSpeedState(s); speedRef.current = s }
  }, [])

  const resetState = useCallback(() => {
    setSpeaking(false)
    setPaused(false)
    setLoading(false)
    setActiveKey(null)
    setActiveLabel(null)
    setSectionIndex(-1)
    setQueueLength(0)
    setElapsed(0)
    setDuration(0)
    setSlice(null)
    sliceEndRef.current = null
    activeKeyRef.current = null
    queueRef.current = []
    queueIdxRef.current = -1
  }, [])

  const stop = useCallback(() => {
    tokenRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    resetState()
  }, [resetState])

  const stopIf = useCallback((key: string) => {
    const live = activeKeyRef.current
    if (live === key || live?.startsWith(`${key}:`)) stop()
  }, [stop])

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.ontimeupdate = () => {
        setElapsed(audio.currentTime)
        const stopAt = sliceEndRef.current
        if (stopAt != null && audio.currentTime >= stopAt) {
          sliceEndRef.current = null
          audio.pause()
          finishRef.current?.()
        }
      }
      audio.onloadedmetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current
    if (!audio || !audio.duration || !Number.isFinite(audio.duration)) return
    const clamped = Math.min(Math.max(fraction, 0), 1)
    // Scrubbing a section stays inside that section.
    const from = slice?.start ?? 0
    const to = slice?.end ?? audio.duration
    audio.currentTime = from + clamped * (to - from)
    setElapsed(audio.currentTime)
  }, [slice])

  // Metadata is needed before a slice can be converted from fractions to
  // seconds. Bounded so a stalled load cannot hang playback.
  function whenReady(audio: HTMLAudioElement): Promise<void> {
    if (audio.readyState >= 1) return Promise.resolve()
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); audio.removeEventListener('loadedmetadata', done); resolve() }
      const timer = setTimeout(done, 4000)
      audio.addEventListener('loadedmetadata', done, { once: true })
    })
  }

  // Resolve one queue item to a playable URL. Pre-generated files are free;
  // anything else goes through /api/tts (which now checks storage before it
  // bills OpenAI) and is cached in-session.
  const resolveUrl = useCallback(async (item: SpeakItem, token: number): Promise<string | null> => {
    if (item.preGeneratedUrl) return item.preGeneratedUrl

    const voice = genderRef.current === 'male' ? 'onyx' : 'nova'
    const cacheKey = `${voice}:${hashText(item.text)}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    const controller = new AbortController()
    abortRef.current = controller

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text, voice, name_normalized: item.nameNormalized }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('TTS failed')
    const blob = await res.blob()
    if (tokenRef.current !== token) return null

    const blobUrl = URL.createObjectURL(blob)
    cacheSet(cacheKey, blobUrl, audioRef.current?.src)
    return blobUrl
  }, [])

  // Play queue position `idx`. Called on start and again from `ended`.
  // Held in a ref so the `ended` handler can advance without a circular
  // reference back into its own useCallback.
  const playIndexRef = useRef<(idx: number, token: number) => Promise<void>>(async () => {})

  const playIndex = useCallback(async (idx: number, token: number) => {
    const item = queueRef.current[idx]
    if (!item || tokenRef.current !== token) return

    queueIdxRef.current = idx
    setSectionIndex(idx)
    setLoading(true)

    try {
      const url = await resolveUrl(item, token)
      if (!url || tokenRef.current !== token) return

      const audio = getAudio()
      const finish = () => {
        if (tokenRef.current !== token) return
        const next = queueIdxRef.current + 1
        if (next < queueRef.current.length) {
          void playIndexRef.current(next, token)
        } else {
          resetState()
        }
      }
      finishRef.current = finish

      audio.onplay = () => {
        if (tokenRef.current !== token) return
        setLoading(false)
        setSpeaking(true)
        setPaused(false)
      }
      // The old code treated the promise from play() as "finished speaking".
      // It settles when playback BEGINS, so the button flipped back to idle a
      // few milliseconds in and the next tap restarted the clip. Only `ended`
      // means done.
      audio.onended = finish
      audio.onerror = () => {
        if (tokenRef.current !== token) return
        resetState()
      }

      if (audio.src !== url) audio.src = url
      audio.playbackRate = speedRef.current
      sliceEndRef.current = null

      if (item.slice) {
        await whenReady(audio)
        if (tokenRef.current !== token) return
        const total = Number.isFinite(audio.duration) ? audio.duration : 0
        if (total > 0) {
          const from = Math.max(0, item.slice.start * total - SLICE_LEAD_IN)
          const to = Math.min(total, item.slice.end * total + SLICE_TAIL)
          audio.currentTime = from
          sliceEndRef.current = to
          setSlice({ start: from, end: to })
        } else {
          // Duration never arrived. Reading the whole thing beats reading nothing.
          audio.currentTime = 0
          setSlice(null)
        }
      } else {
        audio.currentTime = 0
        setSlice(null)
      }

      await audio.play()
      // Safari resets playbackRate when a new source starts.
      audio.playbackRate = speedRef.current
    } catch (err) {
      if (tokenRef.current !== token) return
      if ((err as Error)?.name === 'AbortError') return
      resetState()
    }
  }, [getAudio, resolveUrl, resetState])

  playIndexRef.current = playIndex

  const speakQueue = useCallback(async (items: SpeakItem[], opts?: SpeakOpts) => {
    const usable = items.filter(i => i.text?.trim())
    stop()
    if (!usable.length) return
    const token = tokenRef.current
    queueRef.current = usable
    queueIdxRef.current = -1
    activeKeyRef.current = opts?.key ?? null
    setQueueLength(usable.length)
    setActiveKey(opts?.key ?? null)
    setActiveLabel(opts?.label ?? null)
    setLoading(true)
    await playIndex(0, token)
  }, [stop, playIndex])

  const speak = useCallback(async (text: string, opts?: SpeakOpts) => {
    await speakQueue(
      [{ text, preGeneratedUrl: opts?.preGeneratedUrl, nameNormalized: opts?.nameNormalized, slice: opts?.slice }],
      opts,
    )
  }, [speakQueue])

  const toggle = useCallback(async (key: string, items: SpeakItem[] | string, opts?: SpeakOpts) => {
    if (activeKeyRef.current === key) { stop(); return }
    const list = typeof items === 'string'
      ? [{ text: items, preGeneratedUrl: opts?.preGeneratedUrl, nameNormalized: opts?.nameNormalized, slice: opts?.slice }]
      : items
    await speakQueue(list, { ...opts, key })
  }, [stop, speakQueue])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audio.paused) return
    audio.pause()
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.paused || !activeKeyRef.current) return
    audio.playbackRate = speedRef.current
    void audio.play()
    setPaused(false)
  }, [])

  const setGender = useCallback((next: TTSGender) => {
    genderRef.current = next
    setGenderState(next)
    localStorage.setItem('tts_gender', next)
    stop()
  }, [stop])

  const toggleGender = useCallback(() => {
    setGender(genderRef.current === 'male' ? 'female' : 'male')
  }, [setGender])

  const setSpeed = useCallback((next: number) => {
    speedRef.current = next
    setSpeedState(next)
    localStorage.setItem('tts_speed', String(next))
    // playbackRate applies to the already-generated MP3s, so speed is free and
    // works retroactively. No regeneration, and no need to restart the clip.
    if (audioRef.current) audioRef.current.playbackRate = next
  }, [])

  // The hook used to stop on unmount. Living at layout level it never unmounts,
  // so navigation is what has to stop playback now.
  const pathname = usePathname()
  const firstPath = useRef(true)
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return }
    stop()
  }, [pathname, stop])

  const value = useMemo<TTSValue>(() => ({
    speak, speakQueue, toggle, stop, stopIf, pause, resume, seek,
    speaking, paused, loading, activeKey, activeLabel, sectionIndex, queueLength,
    gender, toggleGender, setGender, speed, setSpeed,
  }), [
    speak, speakQueue, toggle, stop, stopIf, pause, resume, seek,
    speaking, paused, loading, activeKey, activeLabel, sectionIndex, queueLength,
    gender, toggleGender, setGender, speed, setSpeed,
  ])

  // Reported relative to the slice when one is playing, so reading a single
  // section shows a bar that runs 0 to 100 rather than 40 to 60.
  const progressValue = useMemo<TTSProgressValue>(() => {
    const from = slice?.start ?? 0
    const to = slice?.end ?? duration
    const span = Math.max(to - from, 0)
    const at = Math.min(Math.max(elapsed - from, 0), span)
    return { elapsed: at, duration: span, progress: span > 0 ? at / span : 0 }
  }, [elapsed, duration, slice])

  return (
    <TTSContext.Provider value={value}>
      <TTSProgressContext.Provider value={progressValue}>
        {children}
      </TTSProgressContext.Provider>
    </TTSContext.Provider>
  )
}

export function useTTS(): TTSValue {
  const ctx = useContext(TTSContext)
  if (!ctx) throw new Error('useTTS must be used inside <TTSProvider>')
  return ctx
}

export function useTTSProgress(): TTSProgressValue {
  return useContext(TTSProgressContext)
}
