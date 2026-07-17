#!/usr/bin/env node
/**
 * Production bundle verification (no dependencies).
 *
 * Fails the build if dist/ contains source maps, secrets, private or Railway
 * endpoints, forbidden third-party services, prohibited execution CTAs,
 * eval() in production JS, unapproved analytics, or assets above the documented
 * budgets.
 *
 * Analytics allowlist: the ONLY analytics permitted is the approved,
 * consent-gated Google Analytics 4 measurement id (gtag.js). Any other GA4 id,
 * any GTM container id, a hardcoded google-analytics.com reference, analytics
 * in served HTML, or the gtag.js loader outside JavaScript is a failure.
 *
 * `collectFailures(distDir)` is exported so the checks can be unit-tested
 * against fixtures; the CLI wrapper runs it against ../dist.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Documented asset budgets (bytes, uncompressed). The main JS bundle is
// ~370 KB today; budgets leave headroom without hiding a runaway asset.
const BUDGETS = {
  js: 450_000,
  css: 80_000,
  html: 20_000,
  png: 120_000,
  svg: 20_000,
  other: 150_000,
}

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.html',
  '.svg',
  '.txt',
  '.xml',
  '.webmanifest',
  '.json',
])

// The single approved, consent-gated GA4 measurement id and the gtag.js loader
// host. GA4 replaced Google Tag Manager: no GTM container may appear anymore.
const APPROVED_GA_ID = 'G-PNQWWXSPZX'
const ANALYTICS_LOADER_HOST = 'googletagmanager.com'

const FORBIDDEN_PATTERNS = [
  { name: 'source map reference', regex: /sourceMappingURL/ },
  { name: 'Railway domain', regex: /\.up\.railway\.app/i },
  { name: 'Railway reference', regex: /railway/i },
  { name: 'private backend repo', regex: /strateva-platform-private/i },
  { name: 'Firebase', regex: /firebase/i },
  { name: 'Supabase', regex: /supabase/i },
  { name: 'Google login', regex: /accounts\.google\.com|google.?signin|gsi\/client/i },
  // Other analytics vendors, and a HARDCODED google-analytics.com reference,
  // stay forbidden. GA4's collection endpoints are contacted at runtime by
  // gtag.js (Google's code), not baked into the bundle; the only approved
  // analytics id/host is checked separately (see the GA4 allowlist below).
  {
    name: 'non-consented analytics',
    regex: /mixpanel|segment\.io|hotjar|plausible\.io|posthog|google-analytics\.com/i,
  },
  { name: 'prohibited CTA', regex: /send money|pay now|transfer now/i },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Stripe live key', regex: /sk_live_[0-9a-zA-Z]{10,}/ },
  { name: 'GitHub token', regex: /gh[pousr]_[0-9A-Za-z]{20,}/ },
  { name: 'Slack token', regex: /xox[baprs]-/ },
]

function walk(dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full))
    } else {
      entries.push(full)
    }
  }
  return entries
}

function budgetFor(ext) {
  if (ext === '.js') return BUDGETS.js
  if (ext === '.css') return BUDGETS.css
  if (ext === '.html') return BUDGETS.html
  if (ext === '.png') return BUDGETS.png
  if (ext === '.svg') return BUDGETS.svg
  return BUDGETS.other
}

/**
 * Scan a built dist/ directory and return every verification failure (empty
 * array = clean). Pure over the filesystem; used by both the CLI and tests.
 */
export function collectFailures(distDir) {
  const failures = []
  const files = walk(distDir)

  for (const file of files) {
    const rel = relative(distDir, file)
    const ext = extname(file).toLowerCase()

    if (ext === '.map') {
      failures.push(`${rel}: source map file present`)
      continue
    }

    const size = statSync(file).size
    const budget = budgetFor(ext)
    if (size > budget) {
      failures.push(`${rel}: ${size} bytes exceeds the ${budget}-byte budget`)
    }

    if (!TEXT_EXTENSIONS.has(ext)) continue
    const content = readFileSync(file, 'utf8')

    for (const { name, regex } of FORBIDDEN_PATTERNS) {
      if (regex.test(content)) {
        failures.push(`${rel}: contains forbidden pattern (${name})`)
      }
    }

    if (ext === '.js' && /\beval\(/.test(content)) {
      failures.push(`${rel}: contains eval( in production bundle`)
    }

    // --- Analytics allowlist (consent-gated GA4 only) ---
    // Only the approved GA4 measurement id may appear; any other G-XXXX fails.
    for (const id of content.match(/\bG-[A-Z0-9]{6,}\b/g) ?? []) {
      if (id !== APPROVED_GA_ID) {
        failures.push(`${rel}: unapproved GA4 measurement id (${id})`)
      }
    }
    // GA4 replaced Google Tag Manager — no GTM container id may appear at all.
    for (const id of content.match(/\bGTM-[A-Z0-9]+\b/g) ?? []) {
      failures.push(`${rel}: GTM container id no longer allowed (${id})`)
    }
    // The gtag.js loader host may appear ONLY in JavaScript (the consent module
    // bundle) — never in served HTML or any other asset.
    if (content.includes(ANALYTICS_LOADER_HOST) && ext !== '.js') {
      failures.push(`${rel}: analytics loader reference must appear only in JS`)
    }
    // Served HTML must never reference analytics (JS-injected on consent, not
    // baked into the markup): no loader host, no gtag( bootstrap, no GA4 id.
    if (
      ext === '.html' &&
      (content.includes(ANALYTICS_LOADER_HOST) ||
        /\bgtag\s*\(/.test(content) ||
        /\bG-[A-Z0-9]{6,}\b/.test(content) ||
        content.includes('gtm.start'))
    ) {
      failures.push(`${rel}: analytics must not appear in served HTML`)
    }
  }

  return { failures, checked: files.length }
}

// Only run the CLI when executed directly (never on import, e.g. from tests).
// Guarded so a non-file import.meta.url — as under a test runner — can't throw.
function isCli() {
  try {
    return (
      Boolean(process.argv[1]) &&
      import.meta.url === pathToFileURL(process.argv[1]).href
    )
  } catch {
    return false
  }
}

if (isCli()) {
  const DIST = fileURLToPath(new URL('../dist', import.meta.url))
  let result
  try {
    result = collectFailures(DIST)
  } catch {
    console.error('verify:dist — dist/ not found. Run `npm run build` first.')
    process.exit(1)
  }

  if (result.failures.length > 0) {
    console.error('verify:dist FAILED:')
    for (const failure of result.failures) console.error(`  - ${failure}`)
    process.exit(1)
  }

  console.log(
    `verify:dist OK — ${result.checked} files checked, no source maps, ` +
      'no secrets, no private/Railway endpoints, no forbidden services or CTAs, ' +
      'no eval, only the approved consent-gated GA4 measurement id, all assets ' +
      'within budget.',
  )
}
