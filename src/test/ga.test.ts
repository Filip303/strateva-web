import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GA_MEASUREMENT_ID,
  loadAnalytics,
  resetAnalyticsForTests,
} from '../analytics/ga'

type DataLayerWindow = { dataLayer?: unknown[] }

function analyticsScripts(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll('script')].filter((s) =>
    s.src.includes('googletagmanager.com/gtag/js'),
  )
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
})
