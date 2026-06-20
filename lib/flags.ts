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
