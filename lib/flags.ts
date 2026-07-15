// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL LAUNCH FLAGS — single source of truth.
//
// ⚠️ BILLING GO-LIVE CHECKLIST: when subscriptions (RevenueCat / Stripe) are
// wired up and ready, set BILLING_LIVE = true HERE (one place) and every
// billing-gated feature turns on at once. Do this as the FINAL step of the
// billing build, before launch.
//
// Features currently gated on BILLING_LIVE:
//   • Delete-account save offer → shows a real discount/win-back offer for the
//     "too expensive" reason (components/account/DeleteAccountModal.tsx).
//
// When you add anything else that should only appear once billing exists, gate
// it on this same flag and add it to the list above so the go-live switch stays
// one-and-done.
// ─────────────────────────────────────────────────────────────────────────────
export const BILLING_LIVE = false

// ─────────────────────────────────────────────────────────────────────────────
// COACH VOICE CLONING — "Your coach, in your ear, every rep."
//
// Turns on the coach's voice-cloning setup card (Coach Dashboard) and routes the
// coached client's 🔈 button through the coach's cloned voice.
//
// This is the UI kill-switch only. The feature ALSO requires the server env var
// ELEVENLABS_API_KEY to be set in Vercel — without it the routes report
// "not configured" and the card shows a graceful "being set up" state instead of
// erroring. So it's safe to leave this true before the key lands.
//
// 💰 Commercial-use note: ElevenLabs' FREE tier is non-commercial + needs
// attribution. Before any PAYING customer hears a cloned voice, upgrade to at
// least the $5 Starter plan (same API key — no code change, just billing).
// This is a natural paid coach-tier upsell (see memory project_coach_pricing).
// ─────────────────────────────────────────────────────────────────────────────
export const COACH_VOICE_CLONING = true

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING LANDING PAGE — the public homepage at atlasprime.app ("/").
//
// true  → logged-out visitors see the marketing landing page (components/landing).
// false → INSTANT REVERT: "/" goes straight to the sign-in page like it used to,
//         no redeploy required beyond flipping this one line.
//
// Logged-in users always skip the landing and go to /today regardless.
// ─────────────────────────────────────────────────────────────────────────────
export const LANDING_LIVE = true
