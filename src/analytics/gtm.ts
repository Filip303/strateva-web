/**
 * Google Tag Manager loader — first-party, consent-gated.
 *
 * Called ONLY after the user grants analytics consent (src/analytics/consent.ts).
 * This mirrors the official GTM bootstrap but as a first-party module rather than
 * an inline <script>, so the Content-Security-Policy needs no `unsafe-inline`.
 * GTM itself is fetched from googletagmanager.com, which the CSP allows for
 * script-src / img-src / connect-src (see docs/WEB_SECURITY_HEADERS.md). The
 * loader is idempotent: it injects the tag at most once per page.
 */

export const GTM_CONTAINER_ID = 'GTM-KR2W2R68'

interface DataLayerWindow {
  dataLayer?: unknown[]
}

let injected = false

export function loadGtm(): void {
  if (injected) return
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  injected = true

  const w = window as DataLayerWindow
  w.dataLayer = w.dataLayer ?? []
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`
  document.head.appendChild(script)
}

/** Test-only: reset the idempotency guard so a fresh injection can be asserted. */
export function resetGtmForTests(): void {
  injected = false
}
