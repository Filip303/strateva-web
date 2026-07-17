#!/usr/bin/env node
/**
 * Container smoke test for the Railway/Caddy hosting image (no dependencies,
 * no external services, no secrets).
 *
 * Builds the image with a fake, unresolvable API origin (`.invalid` TLD,
 * RFC 2606 — nothing can ever call it), runs the container on loopback only
 * and verifies the serving contract end to end:
 *
 *   - build FAILS when VITE_API_URL is missing or not a clean http(s) origin
 *   - /health answers 200 with a constant body and no internal info
 *   - per-route HTML: /simulator, /methodology and /legal/privacy return
 *     their OWN initial title/canonical before any JavaScript runs
 *   - unknown routes get the SPA fallback shell (HTTP 200; React renders
 *     the 404 page — a real HTTP 404 status is deliberately not claimed)
 *   - JS/CSS are served with correct Content-Type; source maps are 404
 *   - the exact security-header contract from docs/WEB_SECURITY_HEADERS.md
 *     is present on every response, with connect-src bound to the SAME
 *     origin the build was given — no wildcards, no unsafe-eval, no Railway
 *   - hashed assets are immutable; HTML revalidates (fast rollback)
 *   - HSTS: absent in staging, present ONLY with STRATEVA_HSTS=production,
 *     and absent again for any invalid value (fail-closed)
 *
 * Deterministic, bounded timeouts throughout; containers are removed even
 * when an assertion fails.
 */

import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const IMAGE = 'strateva-web-smoke'
const FAKE_ORIGIN = 'https://staging-api.example.invalid'
const CONTAINER_PORT = '8080'
const HEALTH_ATTEMPTS = 60 // x 500 ms = 30 s bound
const FETCH_TIMEOUT_MS = 5_000
const BUILD_TIMEOUT_MS = 15 * 60_000

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; " +
  "font-src 'self'; " +
  `connect-src 'self' ${FAKE_ORIGIN}; ` +
  "base-uri 'none'; object-src 'none'; frame-ancestors 'none'; " +
  "form-action 'self'; upgrade-insecure-requests"
const EXPECTED_HSTS = 'max-age=31536000; includeSubDomains'
const EXPECTED_PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=()'

const startedContainers = []

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: BUILD_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SMOKE FAILED — ${message}`)
  }
}

function buildImage() {
  console.log(`[build] docker build with VITE_API_URL=${FAKE_ORIGIN}`)
  docker(
    ['build', '--build-arg', `VITE_API_URL=${FAKE_ORIGIN}`, '-t', IMAGE, '.'],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  )
}

function expectBuildFailure(label, extraArgs) {
  console.log(`[build] expecting FAILURE: ${label}`)
  let failed = false
  try {
    docker(['build', ...extraArgs, '-t', `${IMAGE}-must-fail`, '.'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    failed = true
  }
  assert(failed, `docker build unexpectedly succeeded: ${label}`)
}

function startContainer(name, envArgs) {
  docker([
    'run',
    '--detach',
    '--name',
    name,
    '--publish',
    `127.0.0.1:0:${CONTAINER_PORT}`,
    '--env',
    `PORT=${CONTAINER_PORT}`,
    ...envArgs,
    IMAGE,
  ])
  startedContainers.push(name)
  const mapping = docker(['port', name, `${CONTAINER_PORT}/tcp`]).trim()
  const port = mapping.split('\n')[0].split(':').pop()
  assert(/^\d+$/.test(port ?? ''), `cannot parse published port ("${mapping}")`)
  return `http://127.0.0.1:${port}`
}

function removeContainers() {
  for (const name of startedContainers.splice(0)) {
    try {
      execFileSync('docker', ['rm', '--force', name], {
        stdio: 'ignore',
        timeout: 60_000,
      })
    } catch {
      // Best effort: never mask the original failure.
    }
  }
}

async function get(base, path) {
  const response = await fetch(`${base}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  return { response, body: await response.text() }
}

async function waitForHealth(base) {
  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt++) {
    try {
      const { response, body } = await get(base, '/health')
      if (response.status === 200) {
        assert(body === 'ok', `/health body is "${body}", expected "ok"`)
        return
      }
    } catch {
      // Container still booting.
    }
    await sleep(500)
  }
  throw new Error(`SMOKE FAILED — /health never became ready at ${base}`)
}

function assertSecurityHeaders(headers, where) {
  assert(
    headers.get('content-security-policy') === EXPECTED_CSP,
    `${where}: CSP mismatch.\n  expected: ${EXPECTED_CSP}\n  actual:   ${headers.get('content-security-policy')}`,
  )
  const csp = headers.get('content-security-policy')
  for (const forbidden of ['unsafe-eval', 'unsafe-inline', '*', 'railway']) {
    assert(!csp.includes(forbidden), `${where}: CSP contains "${forbidden}"`)
  }
  assert(
    headers.get('x-content-type-options') === 'nosniff',
    `${where}: X-Content-Type-Options is "${headers.get('x-content-type-options')}"`,
  )
  assert(
    headers.get('referrer-policy') === 'no-referrer',
    `${where}: Referrer-Policy is "${headers.get('referrer-policy')}"`,
  )
  assert(
    headers.get('permissions-policy') === EXPECTED_PERMISSIONS_POLICY,
    `${where}: Permissions-Policy is "${headers.get('permissions-policy')}"`,
  )
}

async function assertRouteHtml(base, path, title) {
  const { response, body } = await get(base, path)
  assert(response.status === 200, `${path} answered ${response.status}`)
  assert(
    (response.headers.get('content-type') ?? '').startsWith('text/html'),
    `${path} Content-Type is "${response.headers.get('content-type')}"`,
  )
  assert(
    body.includes(`<title>${title}</title>`),
    `${path} initial HTML does not carry the title "${title}" before JS`,
  )
  assert(
    body.includes(`href="https://strateva.ai${path === '/' ? '/' : path}"`),
    `${path} initial HTML does not carry its own canonical URL`,
  )
  assertSecurityHeaders(response.headers, path)
  return { response, body }
}

async function runStagingAssertions(base) {
  // Health: 200, constant body, no internal info, same security headers.
  const health = await get(base, '/health')
  assert(health.response.status === 200, '/health is not 200')
  assert(health.body === 'ok', `/health body is "${health.body}"`)
  assertSecurityHeaders(health.response.headers, '/health')

  // Per-route HTML: each public route serves ITS OWN generated HTML —
  // title and canonical are present in the raw response, before any JS.
  const home = await assertRouteHtml(
    base,
    '/',
    'Strateva Payment Router — Simulation Lab',
  )
  await assertRouteHtml(base, '/simulator', 'Simulator — Strateva Payment Router')
  await assertRouteHtml(
    base,
    '/methodology',
    'Methodology — Strateva Payment Router',
  )
  await assertRouteHtml(
    base,
    '/legal/privacy',
    'Privacy — Strateva Payment Router',
  )

  // Rollback-friendly caching: HTML revalidates on every request.
  assert(
    home.response.headers.get('cache-control') === 'no-cache',
    `/ Cache-Control is "${home.response.headers.get('cache-control')}"`,
  )

  // Unknown route: SPA fallback shell with HTTP 200 (React renders the 404
  // page client-side; a real HTTP 404 is deliberately not claimed).
  const unknown = await get(base, '/this-route-does-not-exist')
  assert(
    unknown.response.status === 200,
    `unknown route answered ${unknown.response.status}, expected the SPA fallback`,
  )
  assert(
    unknown.body.includes(
      '<title>Strateva Payment Router — Simulation Lab</title>',
    ),
    'unknown route did not serve the SPA fallback shell',
  )
  assertSecurityHeaders(unknown.response.headers, 'SPA fallback')

  // Hashed assets: correct Content-Type, immutable caching, CSP present.
  const jsPath = home.body.match(/\/assets\/[^"']+\.js/)?.[0]
  const cssPath = home.body.match(/\/assets\/[^"']+\.css/)?.[0]
  assert(jsPath, 'no /assets/*.js reference found in the home HTML')
  assert(cssPath, 'no /assets/*.css reference found in the home HTML')

  const js = await get(base, jsPath)
  assert(js.response.status === 200, `${jsPath} answered ${js.response.status}`)
  assert(
    (js.response.headers.get('content-type') ?? '').includes('javascript'),
    `${jsPath} Content-Type is "${js.response.headers.get('content-type')}"`,
  )
  assert(
    js.response.headers.get('cache-control') ===
      'public, max-age=31536000, immutable',
    `${jsPath} Cache-Control is "${js.response.headers.get('cache-control')}"`,
  )
  assertSecurityHeaders(js.response.headers, jsPath)

  const css = await get(base, cssPath)
  assert(css.response.status === 200, `${cssPath} answered ${css.response.status}`)
  assert(
    (css.response.headers.get('content-type') ?? '').startsWith('text/css'),
    `${cssPath} Content-Type is "${css.response.headers.get('content-type')}"`,
  )

  // Source maps never exist in the image (verify:dist enforces it at build):
  // requesting one must be a plain 404, not a fallback page.
  const map = await get(base, `${jsPath}.map`)
  assert(
    map.response.status === 404,
    `${jsPath}.map answered ${map.response.status}, expected 404`,
  )

  // Staging must NOT send HSTS (plain-HTTP behind Railway's TLS edge is
  // only declared production explicitly).
  assert(
    home.response.headers.get('strict-transport-security') === null,
    'staging container sent Strict-Transport-Security',
  )
}

async function runHstsModeAssertions() {
  // Production mode: STRATEVA_HSTS=production sends the documented header.
  const prodBase = startContainer(`${IMAGE}-prod-${process.pid}`, [
    '--env',
    'STRATEVA_HSTS=production',
  ])
  await waitForHealth(prodBase)
  const prod = await get(prodBase, '/')
  assert(
    prod.response.headers.get('strict-transport-security') === EXPECTED_HSTS,
    `production HSTS is "${prod.response.headers.get('strict-transport-security')}", expected "${EXPECTED_HSTS}"`,
  )
  assertSecurityHeaders(prod.response.headers, 'production /')

  // Fail-closed: any value other than exactly "production" must NOT enable
  // HSTS (an invalid value never produces a permissive config).
  const invalidBase = startContainer(`${IMAGE}-invalid-${process.pid}`, [
    '--env',
    'STRATEVA_HSTS=yes-please',
  ])
  await waitForHealth(invalidBase)
  const invalid = await get(invalidBase, '/')
  assert(
    invalid.response.headers.get('strict-transport-security') === null,
    'invalid STRATEVA_HSTS value still enabled HSTS (must fail closed)',
  )
}

try {
  buildImage()

  // The build must fail fast on a missing or invalid public API origin.
  expectBuildFailure('VITE_API_URL missing', [])
  expectBuildFailure('VITE_API_URL not a URL', [
    '--build-arg',
    'VITE_API_URL=not-a-url',
  ])
  expectBuildFailure('VITE_API_URL non-http scheme', [
    '--build-arg',
    'VITE_API_URL=ftp://api.example.invalid',
  ])
  expectBuildFailure('VITE_API_URL with credentials', [
    '--build-arg',
    'VITE_API_URL=https://user:secret@api.example.invalid',
  ])
  expectBuildFailure('VITE_API_URL with a base path', [
    '--build-arg',
    'VITE_API_URL=https://api.example.invalid/v1',
  ])
  expectBuildFailure('VITE_API_URL on a Railway domain', [
    '--build-arg',
    'VITE_API_URL=https://something.up.railway.app',
  ])

  const base = startContainer(`${IMAGE}-staging-${process.pid}`, [])
  console.log(`[run] staging container on ${base} (loopback only)`)
  await waitForHealth(base)
  await runStagingAssertions(base)
  console.log('[ok] staging assertions passed')

  await runHstsModeAssertions()
  console.log('[ok] HSTS mode assertions passed (production on, fail-closed)')

  console.log('container-smoke OK — build validation, routing, headers, ' +
    'caching, source-map 404 and HSTS gating all verified on loopback.')
} finally {
  removeContainers()
}
