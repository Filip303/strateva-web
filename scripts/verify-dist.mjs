#!/usr/bin/env node
/**
 * Production bundle verification (no dependencies).
 *
 * Fails the build if dist/ contains source maps, secrets, private or Railway
 * endpoints, forbidden third-party services, prohibited execution CTAs,
 * eval() in production JS, or assets above the documented budgets.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const DIST = new URL('../dist', import.meta.url).pathname

// Documented asset budgets (bytes, uncompressed). The main JS bundle is
// ~260 KB today; budgets leave headroom without hiding a runaway asset.
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

const FORBIDDEN_PATTERNS = [
  { name: 'source map reference', regex: /sourceMappingURL/ },
  { name: 'Railway domain', regex: /\.up\.railway\.app/i },
  { name: 'Railway reference', regex: /railway/i },
  { name: 'private backend repo', regex: /strateva-platform-private/i },
  { name: 'Firebase', regex: /firebase/i },
  { name: 'Supabase', regex: /supabase/i },
  { name: 'Google login', regex: /accounts\.google\.com|google.?signin|gsi\/client/i },
  {
    name: 'analytics/tracking',
    regex: /googletagmanager|google-analytics|gtag\(|mixpanel|segment\.io|hotjar|plausible\.io|posthog/i,
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

const failures = []
let files
try {
  files = walk(DIST)
} catch {
  console.error('verify:dist — dist/ not found. Run `npm run build` first.')
  process.exit(1)
}

for (const file of files) {
  const rel = relative(DIST, file)
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

  if (TEXT_EXTENSIONS.has(ext)) {
    const content = readFileSync(file, 'utf8')
    for (const { name, regex } of FORBIDDEN_PATTERNS) {
      if (regex.test(content)) {
        failures.push(`${rel}: contains forbidden pattern (${name})`)
      }
    }
    if (ext === '.js' && /\beval\(/.test(content)) {
      failures.push(`${rel}: contains eval( in production bundle`)
    }
  }
}

if (failures.length > 0) {
  console.error('verify:dist FAILED:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`verify:dist OK — ${files.length} files checked, no source maps, ` +
  'no secrets, no private/Railway endpoints, no forbidden services or CTAs, ' +
  'no eval, all assets within budget.')
