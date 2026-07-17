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
 *     is present on every response, with connect-src bound to the SAME API
 *     origin the build was given (plus the fixed Google Analytics gtag.js
 *     hosts) — no unsafe-eval, no unsafe-inline, no Railway
 *   - analytics are consent-gated: GA4 is never hardcoded into the served HTML
 *   - hashed assets are immutable; HTML revalidates (fast rollback)
 *   - deployment mode (STRATEVA_DEPLOYMENT_ENV) is mandatory: staging starts
 *     and sends no HSTS, production starts and sends exactly the documented
 *     HSTS, and a missing or invalid mode makes the container exit non-zero
 *     before it can serve anything (fail-closed)
 *   - staging is non-indexable: X-Robots-Tag noindex on every response and a
 *     robots.txt that disallows all crawling with no production sitemap;
 *     production stays indexable (no noindex, normal robots.txt + sitemap)
 *   - railway.toml keeps the audited enums and leaks no domain/secret/ID
 *   - the Caddyfile stays `caddy fmt`-clean
 *
 * Deterministic, bounded timeouts throughout; containers are removed even
 * when an assertion fails.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const IMAGE = 'strateva-web-smoke'
const FAKE_ORIGIN = 'https://staging-api.example.invalid'
const CONTAINER_PORT = '8080'
const HEALTH_ATTEMPTS = 60 // x 500 ms = 30 s bound
const EXIT_ATTEMPTS = 60 // x 500 ms = 30 s bound
const FETCH_TIMEOUT_MS = 5_000
const BUILD_TIMEOUT_MS = 15 * 60_000

const CADDYFILE = fileURLToPath(new URL('../Caddyfile', import.meta.url))
const VERIFY_RAILWAY = fileURLToPath(
  new URL('./verify-railway-toml.mjs', import.meta.url),
)

const EXPECTED_CSP =
  "default-src 'self'; " +
  "script-src 'self' https://www.googletagmanager.com; " +
  "style-src 'self'; " +
  "img-src 'self' https://www.googletagmanager.com https://www.google-analytics.com; " +
  "font-src 'self'; " +
  `connect-src 'self' ${FAKE_ORIGIN} https://www.googletagmanager.com ` +
  'https://www.google-analytics.com https://*.google-analytics.com ' +
  'https://*.analytics.google.com; ' +
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

// Start detached with a bad/absent deployment mode and confirm the entrypoint
// aborts (container exits non-zero) BEFORE Caddy binds — it must never become
// healthy. Not published: nothing should ever listen.
function expectContainerRefusesToStart(label, envArgs) {
  const name = `${IMAGE}-refuse-${label.replace(/\W+/g, '')}-${process.pid}`
  docker([
    'run',
    '--detach',
    '--name',
    name,
    '--env',
    `PORT=${CONTAINER_PORT}`,
    ...envArgs,
    IMAGE,
  ])
  startedContainers.push(name)
  return (async () => {
    for (let attempt = 0; attempt < EXIT_ATTEMPTS; attempt++) {
      const running = docker([
        'inspect',
        '-f',
        '{{.State.Running}}',
        name,
      ]).trim()
      if (running === 'false') {
        const code = docker([
          'inspect',
          '-f',
          '{{.State.ExitCode}}',
          name,
        ]).trim()
        assert(
          code !== '0',
          `${label}: container exited 0, expected a non-zero refusal`,
        )
        return
      }
      await sleep(500)
    }
    throw new Error(
      `SMOKE FAILED — ${label}: container is still running, expected it to refuse to start`,
    )
  })()
}

// railway.toml must keep the audited enums and leak nothing. Runs the
// dependency-free, no-network validator and fails the smoke test if it does.
function assertRailwayToml() {
  console.log('[check] railway.toml enums and no-leak regression')
  execFileSync('node', [VERIFY_RAILWAY], { stdio: 'inherit', timeout: 30_000 })
}

// The Caddyfile template must stay `caddy fmt`-clean, using the exact Caddy
// binary shipped in the built image (no separate install). A drift here is
// what produced the CI format warning.
function assertCaddyfileFormatted() {
  console.log('[check] Caddyfile is caddy-fmt clean')
  const current = readFileSync(CADDYFILE, 'utf8')
  const formatted = execFileSync(
    'docker',
    ['run', '--rm', '-i', '--entrypoint', 'caddy', IMAGE, 'fmt', '-'],
    { input: current, encoding: 'utf8', timeout: 60_000 },
  )
  assert(
    formatted === current,
    'Caddyfile is not caddy-fmt formatted; run: ' +
      'docker run --rm -i caddy:2.10.2-alpine caddy fmt - < Caddyfile',
  )
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
  // No `unsafe-*` and no Railway host. A bare `*` wildcard source is not
  // asserted here because the analytics allowlist legitimately uses subdomain
  // wildcards (https://*.google-analytics.com); the exact CSP equality above
  // already pins every source, so a stray wildcard could not slip in.
  for (const forbidden of ['unsafe-eval', 'unsafe-inline', 'railway']) {
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

  // Consent-gated analytics: GA4 must NOT be hardcoded into the served HTML —
  // it is injected by first-party JS only after the visitor opts in. The
  // served markup must reference no analytics loader host, no gtag( bootstrap
  // and no GA4 measurement id.
  assert(
    !home.body.includes('googletagmanager') &&
      !/\bgtag\s*\(/.test(home.body) &&
      !/\bG-[A-Z0-9]{6,}\b/.test(home.body),
    'analytics must not appear in the served HTML (consent-gated, JS-injected)',
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

  // Staging (STRATEVA_DEPLOYMENT_ENV=staging) must NOT send HSTS: it serves
  // plain HTTP behind Railway's TLS edge and is not the production origin.
  assert(
    home.response.headers.get('strict-transport-security') === null,
    'staging container sent Strict-Transport-Security',
  )

  // Staging must never be indexed: X-Robots-Tag on EVERY response and a
  // robots.txt that disallows all crawling with no production sitemap.
  const XROBOTS = 'noindex, nofollow, noarchive'
  assert(
    home.response.headers.get('x-robots-tag') === XROBOTS,
    `staging / X-Robots-Tag is "${home.response.headers.get('x-robots-tag')}", expected "${XROBOTS}"`,
  )
  assert(
    js.response.headers.get('x-robots-tag') === XROBOTS,
    `staging asset X-Robots-Tag is "${js.response.headers.get('x-robots-tag')}", expected "${XROBOTS}"`,
  )
  const robots = await get(base, '/robots.txt')
  assert(
    robots.response.status === 200,
    `staging /robots.txt answered ${robots.response.status}`,
  )
  assert(
    robots.body.includes('Disallow: /'),
    `staging /robots.txt does not disallow crawling:\n${robots.body}`,
  )
  assert(
    !robots.body.includes('https://strateva.ai/sitemap.xml'),
    `staging /robots.txt leaks the production sitemap:\n${robots.body}`,
  )
  assert(
    robots.response.headers.get('x-robots-tag') === XROBOTS,
    'staging /robots.txt is missing the X-Robots-Tag directive',
  )
}

async function runDeploymentModeAssertions() {
  // Production mode: STRATEVA_DEPLOYMENT_ENV=production starts and sends the
  // documented HSTS (no preload).
  const prodBase = startContainer(`${IMAGE}-prod-${process.pid}`, [
    '--env',
    'STRATEVA_DEPLOYMENT_ENV=production',
  ])
  await waitForHealth(prodBase)
  const prod = await get(prodBase, '/')
  assert(prod.response.status === 200, `production / answered ${prod.response.status}`)
  assert(
    prod.response.headers.get('strict-transport-security') === EXPECTED_HSTS,
    `production HSTS is "${prod.response.headers.get('strict-transport-security')}", expected "${EXPECTED_HSTS}"`,
  )
  assert(
    !(prod.response.headers.get('strict-transport-security') ?? '').includes(
      'preload',
    ),
    'production HSTS must not include preload',
  )
  assertSecurityHeaders(prod.response.headers, 'production /')

  // Production is indexable: no noindex X-Robots-Tag anywhere, and the
  // normal robots.txt (Allow: / plus the production sitemap) is served.
  const prodXRobots = prod.response.headers.get('x-robots-tag')
  assert(
    prodXRobots === null || !/noindex/i.test(prodXRobots),
    `production / sent an X-Robots-Tag with noindex ("${prodXRobots}")`,
  )
  const prodRobots = await get(prodBase, '/robots.txt')
  assert(
    prodRobots.response.status === 200,
    `production /robots.txt answered ${prodRobots.response.status}`,
  )
  assert(
    prodRobots.body.includes('Allow: /'),
    `production /robots.txt does not allow crawling:\n${prodRobots.body}`,
  )
  assert(
    prodRobots.body.includes('https://strateva.ai/sitemap.xml'),
    `production /robots.txt lost the production sitemap:\n${prodRobots.body}`,
  )
  const prodRobotsXRobots = prodRobots.response.headers.get('x-robots-tag')
  assert(
    prodRobotsXRobots === null || !/noindex/i.test(prodRobotsXRobots),
    `production /robots.txt sent an X-Robots-Tag with noindex ("${prodRobotsXRobots}")`,
  )

  // Mandatory mode, fail-closed: a MISSING mode aborts before boot.
  await expectContainerRefusesToStart('deployment mode missing', [])
  // An INVALID mode aborts before boot (never a silent permissive start).
  await expectContainerRefusesToStart('deployment mode invalid', [
    '--env',
    'STRATEVA_DEPLOYMENT_ENV=prod',
  ])
}

try {
  // Static, no-network regressions first (fast to fail).
  assertRailwayToml()

  buildImage()

  // The Caddyfile template must stay formatted (uses the built image's caddy).
  assertCaddyfileFormatted()

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

  const base = startContainer(`${IMAGE}-staging-${process.pid}`, [
    '--env',
    'STRATEVA_DEPLOYMENT_ENV=staging',
  ])
  console.log(`[run] staging container on ${base} (loopback only)`)
  await waitForHealth(base)
  await runStagingAssertions(base)
  console.log('[ok] staging assertions passed')

  await runDeploymentModeAssertions()
  console.log(
    '[ok] deployment-mode assertions passed (production HSTS on; ' +
      'missing/invalid refuse to start)',
  )

  console.log('container-smoke OK — railway.toml regression, Caddyfile format, ' +
    'build validation, routing, headers, caching, source-map 404 and ' +
    'mandatory deployment-mode HSTS gating all verified on loopback.')
} finally {
  removeContainers()
}
