#!/usr/bin/env node
/**
 * railway.toml regression (no dependencies, no network).
 *
 * Fails if the Railway service config drifts from the audited contract:
 *   - builder is not exactly "DOCKERFILE"
 *   - restartPolicyType is not exactly "ON_FAILURE"
 *   - healthcheckPath is not "/health"
 *   - any key outside the small allowlist appears
 *   - any domain, URL, secret, UUID/ID or environment-variable value leaks in
 *
 * The Railway schema is intentionally NOT downloaded; these are the exact
 * enum literals Railway's schema requires, asserted locally.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TOML = fileURLToPath(new URL('../railway.toml', import.meta.url))

// Every key that may appear (section-qualified), with the exact expected
// value where the contract fixes it. Unlisted keys are a failure.
const EXPECTED = {
  'build.builder': 'DOCKERFILE',
  'build.dockerfilePath': 'Dockerfile',
  'deploy.healthcheckPath': '/health',
  'deploy.healthcheckTimeout': '60',
  'deploy.restartPolicyType': 'ON_FAILURE',
  'deploy.restartPolicyMaxRetries': '3',
}

// Substrings that must never appear anywhere: URLs, Railway domains, the real
// product domain, UUID-shaped IDs, or an inlined public build variable.
const FORBIDDEN = [
  { name: 'URL', regex: /https?:\/\//i },
  { name: 'Railway domain', regex: /railway\.app/i },
  { name: 'product domain', regex: /strateva\.(ai|com)/i },
  { name: 'UUID/ID', regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i },
  { name: 'variable value', regex: /VITE_API_URL|STRATEVA_DEPLOYMENT_ENV/ },
]

const failures = []
let raw
try {
  raw = readFileSync(TOML, 'utf8')
} catch {
  console.error('verify:railway — railway.toml not found.')
  process.exit(1)
}

// Comments are documentation prose (the header legitimately names the public
// VITE_API_URL build argument to explain why it is NOT here); the forbidden
// scan inspects the effective config only, so a leaked domain/secret/ID in an
// actual key=value is caught while the explanatory comment is allowed.
const code = raw
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*$/, ''))
  .join('\n')

for (const { name, regex } of FORBIDDEN) {
  if (regex.test(code)) {
    failures.push(`railway.toml must not contain a ${name}`)
  }
}

let section = ''
const seen = {}
for (const line of raw.split(/\r?\n/)) {
  const text = line.replace(/#.*$/, '').trim()
  if (text === '') continue
  const sectionMatch = text.match(/^\[([A-Za-z0-9_.]+)\]$/)
  if (sectionMatch) {
    section = sectionMatch[1]
    continue
  }
  const kv = text.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/)
  if (!kv) {
    failures.push(`unparseable line: ${line}`)
    continue
  }
  const key = `${section}.${kv[1]}`
  const value = kv[2].trim().replace(/^"(.*)"$/, '$1')
  if (!(key in EXPECTED)) {
    failures.push(`unexpected key "${key}" (not in the allowed set)`)
    continue
  }
  seen[key] = true
  if (value !== EXPECTED[key]) {
    failures.push(
      `${key} is "${value}", expected exactly "${EXPECTED[key]}"`,
    )
  }
}

for (const key of Object.keys(EXPECTED)) {
  if (!seen[key]) failures.push(`missing required key "${key}"`)
}

if (failures.length > 0) {
  console.error('verify:railway FAILED:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(
  'verify:railway OK — builder=DOCKERFILE, restartPolicyType=ON_FAILURE, ' +
    'healthcheckPath=/health, no domains/secrets/IDs/variable values.',
)
