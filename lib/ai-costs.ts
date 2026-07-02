// Single source of truth for AI API pricing. Every route that spends money on
// an AI provider computes its cost here, then logs the exact dollar amount via
// logTokens({ cost_usd }). The admin Spend Tracker sums those stored amounts, so
// mixed providers (Anthropic tokens, OpenAI characters/tokens/minutes) all roll
// up accurately — you can't just multiply "tokens" by one rate across providers.
//
// Update a rate in ONE place when a provider changes pricing.

export const RATES = {
  // Anthropic Claude — per token (Sonnet default; the app runs on Sonnet)
  claudeInputPerTok:   3 / 1_000_000,   // $3  / 1M input tokens
  claudeOutputPerTok:  15 / 1_000_000,  // $15 / 1M output tokens

  // OpenAI
  openaiTtsPerChar:    15 / 1_000_000,  // tts-1: $15 / 1M characters
  openaiEmbedPerTok:   0.02 / 1_000_000, // text-embedding-3-small: $0.02 / 1M tokens
  openaiWhisperPerSec: 0.006 / 60,      // whisper-1: $0.006 / minute
} as const

/** Claude token cost (input + output). */
export function claudeCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens || 0) * RATES.claudeInputPerTok + (outputTokens || 0) * RATES.claudeOutputPerTok
}

/** OpenAI tts-1 — billed per character of input text (summed across voices). */
export function ttsCostUsd(characters: number): number {
  return (characters || 0) * RATES.openaiTtsPerChar
}

/** OpenAI text-embedding-3-small — billed per token. */
export function embedCostUsd(tokens: number): number {
  return (tokens || 0) * RATES.openaiEmbedPerTok
}

/** OpenAI whisper-1 — billed per second of audio ($0.006/min). */
export function whisperCostUsd(seconds: number): number {
  return (seconds || 0) * RATES.openaiWhisperPerSec
}
