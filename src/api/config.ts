/**
 * API configuration.
 *
 * `VITE_API_URL` is the ONLY backend URL. There is deliberately no fallback
 * (no Railway/staging/production default): if the variable is missing or
 * invalid the app fails safe with a sanitized public message and sends no
 * request. Every `VITE_*` variable is public by definition (embedded in the
 * browser bundle) and must never contain a secret.
 */

export function getApiBaseUrl(): string | null {
  const raw: unknown = import.meta.env.VITE_API_URL
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null
  }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  return url.toString().replace(/\/+$/, '')
}
