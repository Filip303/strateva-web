/**
 * Google Analytics 4 loader (gtag.js) — first-party, consent-gated.
 *
 * Called ONLY after the user grants analytics consent (src/analytics/consent.ts).
 * This mirrors Google's gtag.js bootstrap but as a first-party module rather
 * than an inline <script>, so the Content-Security-Policy needs no
 * `unsafe-inline`. gtag.js is fetched from www.googletagmanager.com/gtag/js,
 * which the CSP allows for script-src; GA4's collection endpoints are allowed
 * for img-src / connect-src (see docs/WEB_SECURITY_HEADERS.md). The loader is
 * idempotent: it injects the tag at most once per page.
 */

export const GA_MEASUREMENT_ID = 'G-PNQWWXSPZX'

interface DataLayerWindow {
  dataLayer?: unknown[]
}

let injected = false

export function loadAnalytics(): void {
  if (injected) return
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  injected = true

  const w = window as DataLayerWindow
  const dataLayer = (w.dataLayer = w.dataLayer ?? [])
  // gtag pushes its arguments verbatim onto the dataLayer, exactly as Google's
  // inline snippet does — but defined here in first-party code, no inline tag.
  const gtag = (...args: unknown[]): void => {
    dataLayer.push(args)
  }
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

/** Test-only: reset the idempotency guard so a fresh injection can be asserted. */
export function resetAnalyticsForTests(): void {
  injected = false
}
