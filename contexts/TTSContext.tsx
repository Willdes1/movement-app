'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
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
  /** Skip the API entirely and play this pre-generated file. */
  preGeneratedUrl?: string
  /**
   * Exercise slug. Passing this lets the server save the audio onto the
   * exercise_library row. NEVER pass it for a partial read (a single section),
   * or the row's full-narration file gets overwritten with a fragment.
   */
  nameNormalized?: string
}

export type SpeakItem = {
  text: string
  preGeneratedUrl?: string
  nameNormalized?: string
}

export const TTS_SPEEDS = [0.75, 1, 1.25, 1.5] as const

type TTSValue = {
  /** Read one piece of text. */
  speak: (text: string, opts?: SpeakOpts) => Promise<void>
  /** Read a list back to back, advancing automatically. */
  speakQueue: (items: SpeakItem[], opts?: SpeakOpts) => Promise<void>
  /** Start, or stop if this key is already the live one. */
  toggle: (key: string, items: SpeakItem[] | string, opts?: SpeakOpts) => Promise<void>
  stop: () => void
  /** Stop only if `key` is what is currently playing. Safe to call on unmount. */
  stopIf: (key: string) => void
  pause: () => void
  resume: () => void

  /** True from the moment playback begins until `ended` or stop. */
  speaking: boolean
  paused: boolean
  loading: boolean
  /** Which key is live (loading or speaking), or null. */
  activeKey: string | null
  /** Index into the current queue, or -1. */
  sectionIndex: number
  queueLength: number

  gender: TTSGender
  toggleGender: () => void
  setGender: (g: TTSGender) => void
  speed: number
  setSpeed: (s: number) => void
}

const TTSContext = createContext<TTSValue | null>(null)

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

function cacheSet(key: string, url: string) {
  if (audioCache.size >= MAX_CACHED_CLIPS) {
    const oldest = audioCache.keys().next().value
    if (oldest !== undefined) {
      const stale = audioCache.get(oldest)
      audioCache.delete(oldest)
      if (stale) URL.revokeObjectURL(stale)
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
  const [sectionIndex, setSectionIndex] = useState(-1)
  const [queueLength, setQueueLength] = useState(0)

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
    setSectionIndex(-1)
    setQueueLength(0)
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
    if (activeKeyRef.current === key) stop()
  }, [stop])

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

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
    cacheSet(cacheKey, blobUrl)
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
      audio.onended = () => {
        if (tokenRef.current !== token) return
        const next = queueIdxRef.current + 1
        if (next < queueRef.current.length) {
          void playIndexRef.current(next, token)
        } else {
          resetState()
        }
      }
      audio.onerror = () => {
        if (tokenRef.current !== token) return
        resetState()
      }

      audio.src = url
      audio.currentTime = 0
      audio.playbackRate = speedRef.current
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
    setLoading(true)
    await playIndex(0, token)
  }, [stop, playIndex])

  const speak = useCallback(async (text: string, opts?: SpeakOpts) => {
    await speakQueue(
      [{ text, preGeneratedUrl: opts?.preGeneratedUrl, nameNormalized: opts?.nameNormalized }],
      opts,
    )
  }, [speakQueue])

  const toggle = useCallback(async (key: string, items: SpeakItem[] | string, opts?: SpeakOpts) => {
    if (activeKeyRef.current === key) { stop(); return }
    const list = typeof items === 'string'
      ? [{ text: items, preGeneratedUrl: opts?.preGeneratedUrl, nameNormalized: opts?.nameNormalized }]
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

  return (
    <TTSContext.Provider value={{
      speak, speakQueue, toggle, stop, stopIf, pause, resume,
      speaking, paused, loading, activeKey, sectionIndex, queueLength,
      gender, toggleGender, setGender, speed, setSpeed,
    }}>
      {children}
    </TTSContext.Provider>
  )
}

export function useTTS(): TTSValue {
  const ctx = useContext(TTSContext)
  if (!ctx) throw new Error('useTTS must be used inside <TTSProvider>')
  return ctx
}
