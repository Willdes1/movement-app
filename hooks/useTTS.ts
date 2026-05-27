'use client'
import { useState, useEffect, useCallback } from 'react'

export type TTSGender = 'male' | 'female'

function pickVoice(gender: TTSGender): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const en = voices.filter(v => v.lang.startsWith('en'))
  if (en.length === 0) return undefined

  const maleHints = ['male', 'alex', 'fred', 'daniel', 'david', 'james', 'tom', 'gordon', 'mark', 'lee', 'google us english male']
  const femaleHints = ['female', 'samantha', 'victoria', 'kate', 'tessa', 'fiona', 'moira', 'karen', 'zira', 'google us english']

  const hints = gender === 'male' ? maleHints : femaleHints
  const match = en.find(v => hints.some(h => v.name.toLowerCase().includes(h)))
  if (match) return match

  // Fallback: first voice = male, second (or last) = female
  return gender === 'male' ? en[0] : (en[1] ?? en[en.length - 1])
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [gender, setGender] = useState<TTSGender>(() => {
    if (typeof window === 'undefined') return 'male'
    return (localStorage.getItem('tts_gender') as TTSGender) ?? 'male'
  })

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.88
    utterance.pitch = gender === 'male' ? 0.85 : 1.1

    const go = () => {
      const voice = pickVoice(gender)
      if (voice) utterance.voice = voice
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      go()
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', go, { once: true })
    }
  }, [gender])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleGender = useCallback(() => {
    const next: TTSGender = gender === 'male' ? 'female' : 'male'
    setGender(next)
    localStorage.setItem('tts_gender', next)
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [gender])

  // Clean up on unmount
  useEffect(() => () => { window.speechSynthesis.cancel() }, [])

  return { speak, stop, speaking, gender, toggleGender }
}
