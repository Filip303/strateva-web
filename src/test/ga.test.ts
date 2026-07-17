import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GA_MEASUREMENT_ID,
  loadAnalytics,
  resetAnalyticsForTests,
  revokeAnalyticsConsent,
} from '../analytics/ga'

type DataLayerWindow = { dataLayer?: unknown[] }
type GtagEntry = unknown[]

function analyticsScripts(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll('script')].filter((s) =>
    s.src.includes('googletagmanager.com/gtag/js'),
  )
}

function dataLayer(): GtagEntry[] {
  return (((window as DataLayerWindow).dataLayer ?? []) as GtagEntry[]).filter(
    Array.isArray,
  )
}

function indexOfCommand(command: string): number {
  return dataLayer().findIndex((e) => e[0] === command)
}

// Collect every boolean / 'granted'|'denied' value that touches advertising, to
// assert none is ever left permissive.
function adRelatedValues(): unknown[] {
  const values: unknown[] = []
  for (const entry of dataLayer()) {
    for (const arg of entry) {
      if (arg && typeof arg === 'object') {
        for (const [k, v] of Object.entries(arg as Record<string, unknown>)) {
          if (/^ad_|allow_ad|google_signals/i.test(k)) values.push(v)
        }
      }
    }
    // gtag('set', 'allow_google_signals', false) form
    if (
      entry[0] === 'set' &&
      typeof entry[1] === 'string' &&
      /allow_ad|google_signals/i.test(entry[1])
    ) {
      values.push(entry[2])
    }
  }
  return values
}

describe('GA4 loader', () => {
  beforeEach(() => {
    resetAnalyticsForTests()
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    delete (window as DataLayerWindow).dataLayer
  })
  afterEach(() => resetAnalyticsForTests())

  it('injects gtag.js once with the approved id and seeds the dataLayer', () => {
    loadAnalytics()
    const scripts = analyticsScripts()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toContain(`id=${GA_MEASUREMENT_ID}`)
    expect(scripts[0].async).toBe(true)

    const dl = ((window as DataLayerWindow).dataLayer ?? []) as unknown[]
    const configured = dl.some(
      (entry) =>
        Array.isArray(entry) &&
        entry[0] === 'config' &&
        entry[1] === GA_MEASUREMENT_ID,
    )
    expect(configured).toBe(true)
  })

  it('is idempotent — never injects twice', () => {
    loadAnalytics()
    loadAnalytics()
    expect(analyticsScripts()).toHaveLength(1)
  })

  it('sets Consent Mode + ad restrictions BEFORE config', () => {
    loadAnalytics()
    const consentIdx = indexOfCommand('consent')
    const setIdx = indexOfCommand('set')
    const configIdx = indexOfCommand('config')
    expect(consentIdx).toBeGreaterThanOrEqual(0)
    expect(setIdx).toBeGreaterThanOrEqual(0)
    expect(configIdx).toBeGreaterThanOrEqual(0)
    expect(consentIdx).toBeLessThan(configIdx)
    expect(setIdx).toBeLessThan(configIdx)
  })

  it('grants ONLY analytics_storage; every advertising state is denied', () => {
    loadAnalytics()
    const consentDefault = dataLayer().find(
      (e) => e[0] === 'consent' && e[1] === 'default',
    )
    expect(consentDefault?.[2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
  })

  it('leaves NO advertising option in a permissive state', () => {
    loadAnalytics()
    const values = adRelatedValues()
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) {
      expect(v === true || v === 'granted').toBe(false)
    }
  })

  it('turns Google Signals and ad-personalization signals off', () => {
    loadAnalytics()
    const sets = dataLayer().filter((e) => e[0] === 'set')
    expect(sets).toContainEqual(['set', 'allow_google_signals', false])
    expect(sets).toContainEqual([
      'set',
      'allow_ad_personalization_signals',
      false,
    ])
  })

  it('revokeAnalyticsConsent updates analytics AND all ad states to denied', () => {
    revokeAnalyticsConsent()
    const update = dataLayer().find(
      (e) => e[0] === 'consent' && e[1] === 'update',
    )
    expect(update?.[2]).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    // No script is loaded merely by revoking.
    expect(analyticsScripts()).toHaveLength(0)
  })
})
