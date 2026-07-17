/**
 * API configuration.
 *
 * `VITE_API_URL` is the ONLY backend URL. There is deliberately no fallback
 * (no Railway/staging/production default): if the variable is missing or
 * invalid the app fails safe with a sanitized public message and sends no
 * request. Every `VITE_*` variable is public by definition (embedded in the
 * browser bundle) and must never contain a secret.
 *
 * For v1 only a CLEAN http(s) ORIGIN is accepted (an optional trailing slash
 * is tolerated). Rejected outright: credentials (username/password), a query
 * string, a fragment, and any base path — queries and fragments would break
 * endpoint concatenation, and credentials would end up in the public bundle.
 * Base-path support, if ever needed, must be implemented deliberately.
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
  if (url.username !== '' || url.password !== '') {
    return null
  }
  if (url.search !== '' || url.hash !== '') {
    return null
  }
  // Origin only (an optional trailing slash parses to pathname '/').
  if (url.pathname !== '/' && url.pathname !== '') {
    return null
  }
  // A normalized origin (no trailing slash) makes `${base}${path}`
  // concatenation unambiguous.
  return url.origin
}
