'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export type TTSGender = 'male' | 'female'

// Session cache: text → blob URL (avoids repeat API calls within a session)
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

  const speak = useCallback(async (text: string) => {
    stop()
    setLoading(true)

    const voice = gender === 'male' ? 'onyx' : 'nova'
    const cacheKey = `${voice}:${text}`

    try {
      let blobUrl = audioCache.get(cacheKey)

      if (!blobUrl) {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
        })
        if (!res.ok) throw new Error('TTS API failed')
        const blob = await res.blob()
        blobUrl = URL.createObjectURL(blob)
        audioCache.set(cacheKey, blobUrl)
      }

      const audio = new Audio(blobUrl)
      audioRef.current = audio
      audio.onplay = () => { setLoading(false); setSpeaking(true) }
      audio.onended = () => setSpeaking(false)
      audio.onerror = () => { setSpeaking(false); setLoading(false) }
      await audio.play()
    } catch {
      setLoading(false)
      setSpeaking(false)
    }
  }, [gender, stop])

  const toggleGender = useCallback(() => {
    const next: TTSGender = gender === 'male' ? 'female' : 'male'
    setGender(next)
    localStorage.setItem('tts_gender', next)
    stop()
  }, [gender, stop])

  useEffect(() => () => { stop() }, [stop])

  return { speak, stop, speaking, loading, gender, toggleGender }
}
