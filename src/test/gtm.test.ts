import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GTM_CONTAINER_ID, loadGtm, resetGtmForTests } from '../analytics/gtm'

type DataLayerWindow = { dataLayer?: Array<{ event?: string }> }

function gtmScripts(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll('script')].filter((s) =>
    s.src.includes('googletagmanager.com'),
  )
}

describe('gtm loader', () => {
  beforeEach(() => {
    resetGtmForTests()
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    delete (window as DataLayerWindow).dataLayer
  })
  afterEach(() => resetGtmForTests())

  it('injects the GTM script once and seeds the dataLayer', () => {
    loadGtm()
    const scripts = gtmScripts()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toContain(`id=${GTM_CONTAINER_ID}`)
    expect(scripts[0].async).toBe(true)
    const dl = (window as DataLayerWindow).dataLayer ?? []
    expect(dl.some((entry) => entry.event === 'gtm.js')).toBe(true)
  })

  it('is idempotent — never injects twice', () => {
    loadGtm()
    loadGtm()
    expect(gtmScripts()).toHaveLength(1)
  })
})
