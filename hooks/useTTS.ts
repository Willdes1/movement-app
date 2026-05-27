'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export type TTSGender = 'male' | 'female'

// Session cache: cacheKey → blob URL
const audioCache = new Map<string, string>()

export function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gender, setGender] = useState<TTSGender>(() => {
    if (typeof window === 'undefined') return 'male'
    return (localStorage.getItem('tts_gender') as TTSGender) ?? 'male'
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setSpeaking(false)
    setLoading(false)
  }, [])

  const playUrl = useCallback(async (url: string) => {
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onplay = () => { setLoading(false); setSpeaking(true) }
    audio.onended = () => setSpeaking(false)
    audio.onerror = () => { setSpeaking(false); setLoading(false) }
    await audio.play()
  }, [])

  // speak: uses pre-generated CDN URL if provided, otherwise calls API (and auto-saves if nameNormalized given)
  const speak = useCallback(async (
    text: string,
    opts?: { nameNormalized?: string; preGeneratedUrl?: string }
  ) => {
    stop()
    setLoading(true)

    // Fast path: pre-generated CDN URL
    if (opts?.preGeneratedUrl) {
      await playUrl(opts.preGeneratedUrl)
      return
    }

    const voice = gender === 'male' ? 'onyx' : 'nova'
    const cacheKey = `${voice}:${text.slice(0, 80)}`

    try {
      let blobUrl = audioCache.get(cacheKey)

      if (!blobUrl) {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, name_normalized: opts?.nameNormalized }),
        })
        if (!res.ok) throw new Error('TTS failed')
        const blob = await res.blob()
        blobUrl = URL.createObjectURL(blob)
        audioCache.set(cacheKey, blobUrl)
      }

      await playUrl(blobUrl)
    } catch {
      setLoading(false)
      setSpeaking(false)
    }
  }, [gender, stop, playUrl])

  const toggleGender = useCallback(() => {
    const next: TTSGender = gender === 'male' ? 'female' : 'male'
    setGender(next)
    localStorage.setItem('tts_gender', next)
    stop()
  }, [gender, stop])

  useEffect(() => () => { stop() }, [stop])

  return { speak, stop, speaking, loading, gender, toggleGender }
}
