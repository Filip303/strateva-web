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

// gtag.js is served from googletagmanager.com, with the GA4 measurement id.
const APPROVED_LOADER =
  'https://www.googletagmanager.com/gtag/js?id=G-PNQWWXSPZX'

describe('verify-dist analytics allowlist (GA4)', () => {
  it('passes with only the approved consent-gated GA4 id in JS', () => {
    const dir = makeDist({
      'index.html': '<!doctype html><title>x</title><div id="root"></div>',
      'assets/app.js': `const s=document.createElement('script');s.src=${JSON.stringify(APPROVED_LOADER)};gtag('config','G-PNQWWXSPZX');`,
      'assets/app.css': 'body{color:#000}',
    })
    expect(collectFailures(dir).failures).toEqual([])
  })

  it('fails on any other GA4 measurement id', () => {
    const dir = makeDist({
      'index.html': '<title>x</title>',
      'assets/app.js': `const a=${JSON.stringify(APPROVED_LOADER)};const b='G-ABCDEF12';`,
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('unapproved GA4 measurement id (G-ABCDEF12)'),
      ),
    ).toBe(true)
  })

  it('fails on any GTM container id (GTM was replaced by GA4)', () => {
    const dir = makeDist({
      'index.html': '<title>x</title>',
      'assets/app.js': "const c='GTM-KR2W2R68'",
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('GTM container id no longer allowed'),
      ),
    ).toBe(true)
  })

  it('fails when analytics appears in served HTML', () => {
    const dir = makeDist({
      'index.html': `<script src="${APPROVED_LOADER}"></script>`,
      'assets/app.js': 'const x=1',
    })
    expect(
      collectFailures(dir).failures.some((m) =>
        m.includes('analytics must not appear in served HTML'),
      ),
    ).toBe(true)
  })

  it('fails when the gtag.js loader appears outside JavaScript (e.g. CSS)', () => {
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
