// Emoji-aware display helpers for athlete names. A user can add an emoji to their
// profile name (e.g. "Wheel 💪"); greetings show their first name WITH that emoji,
// while avatar initials use just the letters.

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]+/gu

/**
 * First name, preserving any emoji the user put in their profile name.
 * "Wheel 💪" → "Wheel 💪" · "Will Gonzalez 🔥" → "Will 🔥" · "Wheel" → "Wheel"
 */
export function displayName(fullName?: string | null): string {
  if (!fullName) return ''
  const trimmed = fullName.trim()
  if (!trimmed) return ''
  const emojis = (trimmed.match(EMOJI_RE) || []).join('')
  const firstWord = trimmed.replace(EMOJI_RE, '').trim().split(/\s+/)[0] ?? ''
  if (!firstWord) return emojis
  return emojis ? `${firstWord} ${emojis}` : firstWord
}

/** Uppercase 1–2 letter initials from the text of the name (emoji ignored). */
export function avatarInitials(fullName?: string | null): string {
  if (!fullName) return ''
  const text = fullName.replace(EMOJI_RE, '').trim()
  if (!text) return ''
  return text.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
