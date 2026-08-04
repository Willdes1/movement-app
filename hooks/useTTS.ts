'use client'

// The hook now lives in the provider so every surface shares one audio element.
// Kept as a re-export because three components import from here.
export { useTTS, TTS_SPEEDS } from '@/contexts/TTSContext'
export type { TTSGender, SpeakItem, SpeakOpts } from '@/contexts/TTSContext'
