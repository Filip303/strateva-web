import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectFailures } from '../../scripts/verify-dist.mjs'

const created: string[] = []

function makeDist(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'verifydist-'))
  created.push(dir)
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const APPROVED_LOADER =
  'https://www.googletagmanager.com/gtm.js?id=GTM-KR2W2R68'

describe('verify-dist analytics allowlist', () => {
  it('passes with only the approved consent-gated GTM container in JS', () => {
    const dir = makeDist({
      'index.html': '<!doctype html><title>x</title><div id="root"></div>',
      'assets/app.js': `const s=document.createElement('script');s.src=${JSON.stringify(APPROVED_LOADER)};`,
      'assets/app.css': 'body{color:#000}',
    })
    expect(collectFailures(dir).failures).toEqual([])
  })

  it('fails on any other GTM container id', () => {
    const dir = makeDist({
      'index.html': '<title>x</title>',
      'assets/app.js': `const a=${JSON.stringify(APPROVED_LOADER)};const b='GTM-ZZ9AAA';`,
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('unapproved GTM container id (GTM-ZZ9AAA)'),
      ),
    ).toBe(true)
  })

  it('fails on a direct gtag( bootstrap', () => {
    const dir = makeDist({
      'index.html': '<title>x</title>',
      'assets/app.js': "window.gtag('config','x')",
    })
    expect(
      collectFailures(dir).failures.some((m) => m.includes('gtag(')),
    ).toBe(true)
  })

  it('fails when GTM appears in served HTML', () => {
    const dir = makeDist({
      'index.html': `<script src="${APPROVED_LOADER}"></script>`,
      'assets/app.js': 'const x=1',
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('GTM must not appear in served HTML'),
      ),
    ).toBe(true)
  })

  it('fails when the GTM loader appears outside JavaScript (e.g. CSS)', () => {
    const dir = makeDist({
      'index.html': '<title>x</title>',
      'assets/app.css': '/* googletagmanager.com */',
      'assets/app.js': 'const x=1',
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('loader reference must appear only in JS'),
      ),
    ).toBe(true)
  })

  it('keeps a hardcoded google-analytics.com reference forbidden', () => {
    const dir = makeDist({
      'index.html': '<title>x</title>',
      'assets/app.js': "fetch('https://www.google-analytics.com/g/collect')",
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('non-consented analytics'),
      ),
    ).toBe(true)
  })
})
