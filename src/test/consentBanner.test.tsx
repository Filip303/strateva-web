import { act } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConsentBanner from '../components/ConsentBanner'
import * as consent from '../analytics/consent'
import {
  CONSENT_STORAGE_KEY,
  openConsentPreferences,
  readConsent,
} from '../analytics/consent'
import * as ga from '../analytics/ga'
import { resetAnalyticsForTests } from '../analytics/ga'

type DataLayerWindow = { dataLayer?: unknown[] }

function analyticsScripts(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll('script')].filter((s) =>
    s.src.includes('googletagmanager.com/gtag/js'),
  )
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <ConsentBanner />
    </MemoryRouter>,
  )
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAnalyticsForTests()
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    delete (window as DataLayerWindow).dataLayer
    vi.spyOn(consent, 'reloadPage').mockImplementation(() => {})
  })
  afterEach(() => {
    resetAnalyticsForTests()
    vi.restoreAllMocks()
  })

  it('shows when consent is unset and loads no analytics yet', () => {
    renderBanner()
    expect(
      screen.getByRole('dialog', { name: 'Analytics consent' }),
    ).toBeInTheDocument()
    expect(analyticsScripts()).toHaveLength(0)
  })

  it('Accept stores granted, loads GTM and hides the banner', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Accept analytics' }))
    expect(readConsent()).toBe('granted')
    expect(analyticsScripts()).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Reject stores denied, loads nothing and hides the banner', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(readConsent()).toBe('denied')
    expect(analyticsScripts()).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a previously granted choice re-loads GTM with no banner', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'granted')
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(analyticsScripts()).toHaveLength(1)
  })

  it('a previously denied choice loads nothing and shows no banner', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'denied')
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(analyticsScripts()).toHaveLength(0)
  })

  it('reopening preferences after granting lets the user withdraw', async () => {
    const user = userEvent.setup()
    localStorage.setItem(CONSENT_STORAGE_KEY, 'granted')
    document.cookie = '_ga=GA1.1.999; path=/'
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => openConsentPreferences())
    await screen.findByRole('dialog', { name: 'Analytics consent' })

    await user.click(screen.getByRole('button', { name: 'Withdraw consent' }))
    expect(readConsent()).toBe('denied')
    expect(document.cookie).not.toContain('_ga=')
    expect(consent.reloadPage).toHaveBeenCalledTimes(1)
    // A Consent Mode update denying analytics + all ad states was pushed.
    const dl = ((window as DataLayerWindow).dataLayer ?? []) as unknown[][]
    const update = dl.find(
      (e) => Array.isArray(e) && e[0] === 'consent' && e[1] === 'update',
    )
    expect(update?.[2]).toMatchObject({ analytics_storage: 'denied' })
  })

  it('withdrawal denies consent BEFORE clearing cookies and reloading', async () => {
    const user = userEvent.setup()
    localStorage.setItem(CONSENT_STORAGE_KEY, 'granted')
    renderBanner()
    act(() => openConsentPreferences())
    await screen.findByRole('dialog', { name: 'Analytics consent' })

    const revoke = vi.spyOn(ga, 'revokeAnalyticsConsent')
    const clear = vi.spyOn(consent, 'clearAnalyticsCookies')
    // reloadPage is already mocked in beforeEach.
    await user.click(screen.getByRole('button', { name: 'Withdraw consent' }))

    expect(revoke).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(consent.reloadPage).toHaveBeenCalledTimes(1)
    const revokeOrder = revoke.mock.invocationCallOrder[0]
    const clearOrder = clear.mock.invocationCallOrder[0]
    const reloadOrder = (consent.reloadPage as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]
    expect(revokeOrder).toBeLessThan(clearOrder)
    expect(clearOrder).toBeLessThan(reloadOrder)
  })

  it('reopening preferences after denying lets the user accept', async () => {
    const user = userEvent.setup()
    localStorage.setItem(CONSENT_STORAGE_KEY, 'denied')
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(analyticsScripts()).toHaveLength(0)

    act(() => openConsentPreferences())
    await screen.findByRole('dialog', { name: 'Analytics consent' })

    await user.click(screen.getByRole('button', { name: 'Accept analytics' }))
    expect(readConsent()).toBe('granted')
    expect(analyticsScripts()).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(consent.reloadPage).not.toHaveBeenCalled()
  })
})
