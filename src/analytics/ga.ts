/**
 * Google Analytics 4 loader (gtag.js) — first-party, consent-gated, and
 * restricted to audience measurement only via Consent Mode v2.
 *
 * Called ONLY after the user grants analytics consent (src/analytics/consent.ts),
 * so gtag.js is never loaded and no pings occur before consent. On load we grant
 * ONLY `analytics_storage` (the user just accepted); every advertising state
 * (`ad_storage`, `ad_user_data`, `ad_personalization`) stays `denied`, and both
 * Google Signals and ad-personalization signals — which default to true — are
 * turned OFF. No Ads, remarketing or personalization tags are ever added.
 *
 * The bootstrap is a first-party module (not an inline <script>), so the CSP
 * needs no `unsafe-inline`. gtag.js is fetched from www.googletagmanager.com/
 * gtag/js; GA4 collection goes to google-analytics.com (see
 * docs/WEB_SECURITY_HEADERS.md). The loader is idempotent.
 */

export const GA_MEASUREMENT_ID = 'G-PNQWWXSPZX'

interface DataLayerWindow {
  dataLayer?: unknown[]
}

/** A gtag() that pushes its arguments onto the dataLayer, exactly like Google's
 * snippet — but defined in first-party code, with no inline tag. */
function gtagPusher(): (...args: unknown[]) => void {
  const w = window as DataLayerWindow
  const dataLayer = (w.dataLayer = w.dataLayer ?? [])
  return (...args: unknown[]) => {
    dataLayer.push(args)
  }
}

let injected = false

export function loadAnalytics(): void {
  if (injected) return
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  injected = true

  const gtag = gtagPusher()

  // Consent Mode v2 — set BEFORE any config or event. Only analytics is
  // granted (the visitor just opted in); every advertising state is denied.
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  // Disable Google Signals and ad-personalization signals (both default true).
  gtag('set', 'allow_google_signals', false)
  gtag('set', 'allow_ad_personalization_signals', false)

  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

/**
 * Withdrawal: push a Consent Mode update setting analytics AND all advertising
 * states to `denied`. Called before cookies are cleared and the page reloads,
 * so the already-running GA instance is told to stop before we tear it down.
 */
export function revokeAnalyticsConsent(): void {
  if (typeof window === 'undefined') return
  const gtag = gtagPusher()
  gtag('consent', 'update', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
}

/** Test-only: reset the idempotency guard so a fresh injection can be asserted. */
export function resetAnalyticsForTests(): void {
  injected = false
}
