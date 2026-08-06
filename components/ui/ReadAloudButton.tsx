'use client'
import { useTTS } from '@/hooks/useTTS'
import { buildSpeechText } from '@/lib/speech-text'

// Read-aloud for a library row, anywhere a list shows exercises.
//
// /browse, /exercises and /mobility all already had narration audio in reach
// and no way to play it. /browse was even fetching both voice columns and
// rendering nothing with them.
//
// Rendered as a span, not a button, on purpose: every one of those pages wraps
// its exercise row in a <button>, and a button inside a button is invalid HTML
// that browsers resolve by dropping one of them.

export type ReadAloudExercise = {
  name_normalized: string
  name_display: string
  how?: string | null
  breathing?: string | null
  core?: string | null
  tip?: string | null
  tts_url_male?: string | null
  tts_url_female?: string | null
}

export default function ReadAloudButton({ exercise, size = 14 }: { exercise: ReadAloudExercise; size?: number }) {
  const { toggle, activeKey, speaking, loading, gender } = useTTS()

  // Namespaced so it cannot collide with the exercise sheet's own key for the
  // same movement, and so stopIf can match a whole surface at once.
  const key = `library:${exercise.name_normalized}`
  const isLive = activeKey === key && (speaking || loading)
  const isLoading = activeKey === key && loading

  // Nothing written means nothing worth reading.
  if (!exercise.how && !exercise.breathing && !exercise.core && !exercise.tip) return null

  function play(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    e.preventDefault()
    const preUrl = gender === 'male' ? exercise.tts_url_male : exercise.tts_url_female
    void toggle(key, buildSpeechText(exercise), {
      label: exercise.name_display,
      preGeneratedUrl: preUrl ?? undefined,
      // No cached file, so this generates one and saves it to the row, making
      // the next athlete's play free.
      nameNormalized: preUrl ? undefined : exercise.name_normalized,
    })
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={isLive ? `Stop reading ${exercise.name_display}` : `Read ${exercise.name_display} aloud`}
      title={isLive ? 'Stop' : 'Read aloud'}
      onClick={play}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') play(e) }}
      style={{
        fontSize: size,
        lineHeight: 1,
        cursor: isLoading ? 'wait' : 'pointer',
        color: isLive ? 'var(--accent)' : 'var(--text-dim)',
        flexShrink: 0,
        padding: '2px 4px',
        userSelect: 'none',
      }}
    >
      {isLoading ? '⏳' : isLive ? '🔊' : '🔈'}
    </span>
  )
}
