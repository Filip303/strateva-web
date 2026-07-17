import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAnalyticsCookies,
  CONSENT_EVENT,
  CONSENT_STORAGE_KEY,
  openConsentPreferences,
  readConsent,
  writeConsent,
} from '../analytics/consent'

describe('analytics consent', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to unset when nothing is stored', () => {
    expect(readConsent()).toBe('unset')
  })

  it('reads a stored granted / denied choice', () => {
    writeConsent('granted')
    expect(readConsent()).toBe('granted')
    writeConsent('denied')
    expect(readConsent()).toBe('denied')
  })

  it('treats an invalid stored value as unset', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'maybe')
    expect(readConsent()).toBe('unset')
  })

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    expect(readConsent()).toBe('unset')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    expect(() => writeConsent('granted')).not.toThrow()
  })

  it('openConsentPreferences dispatches the consent event', () => {
    const handler = vi.fn()
    window.addEventListener(CONSENT_EVENT, handler)
    openConsentPreferences()
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONSENT_EVENT, handler)
  })

  it('clearAnalyticsCookies removes only _ga and _ga_* cookies', () => {
    document.cookie = '_ga=GA1.1.123456; path=/'
    document.cookie = '_ga_ABC123=GS1.1.789; path=/'
    document.cookie = 'keep_me=yes; path=/'
    clearAnalyticsCookies()
    expect(document.cookie).not.toContain('_ga=')
    expect(document.cookie).not.toContain('_ga_ABC123=')
    expect(document.cookie).toContain('keep_me=yes')
  })

  it('clearAnalyticsCookies never throws', () => {
    expect(() => clearAnalyticsCookies()).not.toThrow()
  })
})
