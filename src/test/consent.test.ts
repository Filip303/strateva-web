import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_STORAGE_KEY,
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
})
