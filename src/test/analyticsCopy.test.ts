import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GA_MEASUREMENT_ID } from '../analytics/ga'

// These guards exist BECAUSE an approved GA4 id ships. If GA4 were ever removed,
// the precondition below would change and the copy rules could be revisited.
function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}
function normalized(rel: string): string {
  return read(rel).replace(/\s+/g, ' ').toLowerCase()
}

describe('analytics copy guards (while an approved GA4 id ships)', () => {
  it('precondition: an approved GA4 measurement id exists', () => {
    expect(GA_MEASUREMENT_ID).toMatch(/^G-[A-Z0-9]{6,}$/)
  })

  it('README does not falsely claim there is no analytics/tracking/cookies', () => {
    const readme = normalized('README.md')
    expect(readme).not.toContain('there are no analytics, no tracking, no cookies')
    expect(readme).not.toContain('no analytics, no tracking and no cookies')
    // It must actually document that GA4 analytics exists (opt-in).
    expect(readme).toContain('google analytics')
  })

  it('GA4 copy never describes the measurement as "anonymous"', () => {
    const files = [
      'src/components/ConsentBanner.tsx',
      'src/pages/Privacy.tsx',
      'src/pages/Cookies.tsx',
      'AGENTS.md',
      'docs/WEB_SECURITY_HEADERS.md',
    ]
    for (const file of files) {
      expect(read(file)).not.toMatch(/anonymous audience measurement/i)
    }
  })
})
