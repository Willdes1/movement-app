// Platform detection for billing. TODAY everything is web → Stripe. When the app
// is later wrapped with Capacitor for iOS/Android, purchases made INSIDE the
// native app must go through In-App Purchase (RevenueCat), not Stripe — Apple and
// Google require it. This seam lets the billing UI choose: web → Stripe checkout,
// native → IAP. It returns false everywhere until the native wrapper exists, so
// nothing changes today; when we add Capacitor, only the native branch lights up.
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}
