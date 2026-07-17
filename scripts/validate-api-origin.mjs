#!/usr/bin/env node
/**
 * Build-time validation of the public API origin (no dependencies).
 *
 * The Docker build passes `VITE_API_URL` through this script BEFORE building:
 * the exact same value must drive both the app bundle and the CSP
 * `connect-src` rendered into the Caddyfile, so a single validated origin is
 * printed to stdout and reused for both. The rules mirror the runtime
 * validation in `src/api/config.ts`: only a clean `http`/`https` origin is
 * accepted (an optional trailing slash is tolerated); credentials, query
 * strings, fragments and base paths are rejected. Anything else fails the
 * image build — an invalid value must never produce a permissive config.
 *
 * Railway domains are additionally rejected: the CSP contract
 * (docs/WEB_SECURITY_HEADERS.md) forbids `*.up.railway.app` fallbacks and
 * the repository must not reference Railway-generated URLs.
 */

const raw = process.argv[2]

function fail(reason) {
  console.error(
    `VITE_API_URL is not a valid public API origin: ${reason}\n` +
      'Expected a clean http(s) origin such as https://staging-api.example.invalid ' +
      '(no credentials, no path, no query, no fragment).',
  )
  process.exit(1)
}

if (typeof raw !== 'string' || raw.trim() === '') {
  fail('the value is missing or empty — pass --build-arg VITE_API_URL=<origin>')
}

let url
try {
  url = new URL(raw.trim())
} catch {
  fail(`"${raw}" cannot be parsed as a URL`)
}

if (url.protocol !== 'http:' && url.protocol !== 'https:') {
  fail(`protocol "${url.protocol}" is not http or https`)
}
if (url.username !== '' || url.password !== '') {
  fail('the URL carries credentials')
}
if (url.search !== '' || url.hash !== '') {
  fail('the URL carries a query string or fragment')
}
// Origin only (an optional trailing slash parses to pathname '/').
if (url.pathname !== '/' && url.pathname !== '') {
  fail(`the URL carries a base path ("${url.pathname}")`)
}
if (/(^|\.)railway\.app$/i.test(url.hostname)) {
  fail('Railway-generated domains are not allowed as the API origin')
}

// A normalized origin (no trailing slash) keeps the bundle and the CSP
// connect-src byte-identical.
process.stdout.write(url.origin)
