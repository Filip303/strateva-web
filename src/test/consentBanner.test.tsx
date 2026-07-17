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
import { resetGtmForTests } from '../analytics/gtm'

type DataLayerWindow = { dataLayer?: unknown[] }

function gtmScripts(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll('script')].filter((s) =>
    s.src.includes('googletagmanager.com'),
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
    resetGtmForTests()
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    delete (window as DataLayerWindow).dataLayer
    vi.spyOn(consent, 'reloadPage').mockImplementation(() => {})
  })
  afterEach(() => {
    resetGtmForTests()
    vi.restoreAllMocks()
  })

  it('shows when consent is unset and loads no analytics yet', () => {
    renderBanner()
    expect(
      screen.getByRole('dialog', { name: 'Analytics consent' }),
    ).toBeInTheDocument()
    expect(gtmScripts()).toHaveLength(0)
  })

  it('Accept stores granted, loads GTM and hides the banner', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Accept analytics' }))
    expect(readConsent()).toBe('granted')
    expect(gtmScripts()).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Reject stores denied, loads nothing and hides the banner', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(readConsent()).toBe('denied')
    expect(gtmScripts()).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a previously granted choice re-loads GTM with no banner', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'granted')
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gtmScripts()).toHaveLength(1)
  })

  it('a previously denied choice loads nothing and shows no banner', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'denied')
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gtmScripts()).toHaveLength(0)
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
  })

  it('reopening preferences after denying lets the user accept', async () => {
    const user = userEvent.setup()
    localStorage.setItem(CONSENT_STORAGE_KEY, 'denied')
    renderBanner()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gtmScripts()).toHaveLength(0)

    act(() => openConsentPreferences())
    await screen.findByRole('dialog', { name: 'Analytics consent' })

    await user.click(screen.getByRole('button', { name: 'Accept analytics' }))
    expect(readConsent()).toBe('granted')
    expect(gtmScripts()).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(consent.reloadPage).not.toHaveBeenCalled()
  })
})
