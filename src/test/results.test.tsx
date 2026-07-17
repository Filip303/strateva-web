import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { quoteResponseSchema } from '../api/schemas'
import {
  CORRIDOR_OPTION_LABEL,
  corridorsFixture,
  makeDetailedQuoteResponse,
} from './fixtures'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/api/v1/corridors')) return jsonResponse(corridorsFixture)
    if (url.endsWith('/api/v1/routes/quote') && init?.method === 'POST') {
      return jsonResponse(makeDetailedQuoteResponse())
    }
    throw new TypeError(`Unexpected request in test: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function renderResults() {
  installFetch()
  render(
    <MemoryRouter initialEntries={['/simulator']}>
      <App />
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  await screen.findByRole('option', { name: CORRIDOR_OPTION_LABEL })
  await user.type(screen.getByLabelText('Amount (AAA)'), '250')
  await user.click(screen.getByRole('button', { name: 'Compare routes' }))
  await screen.findByRole('heading', { name: 'Results' })
  return { user, recommended: screen.getByRole('region', { name: 'Recommended' }) }
}

describe('detailed fixture', () => {
  it('remains fully valid against the contract schema', () => {
    expect(quoteResponseSchema.safeParse(makeDetailedQuoteResponse()).success).toBe(
      true,
    )
  })
})

describe('leg breakdown', () => {
  it('shows every per-step amount with its correct asset', async () => {
    const { user, recommended } = await renderResults()
    await user.click(within(recommended).getByRole('button', { name: /Leg breakdown/ }))
    const body = within(recommended)
    expect(body.getByText('In: 250.00 AAA → Out: 4821.07 BBB')).toBeVisible()
    expect(
      body.getByText('Fixed fee: 1.25 AAA · Percentage fee: 0.50 AAA'),
    ).toBeVisible()
    expect(body.getByText('Spread cost: 3.75 BBB')).toBeVisible()
    expect(
      body.getByText('Leg 0: fx_conversion via mock_provider'),
    ).toBeVisible()
    expect(body.getByText(/Time: 600 s \(~10 min\) · Reliability: 0.98/)).toBeVisible()
  })

  it('is keyboard accessible (Enter toggles, aria-expanded reflects state)', async () => {
    const { user, recommended } = await renderResults()
    const toggle = within(recommended).getByRole('button', {
      name: /Leg breakdown/,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    toggle.focus()
    expect(toggle).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(recommended).getByText('In: 250.00 AAA → Out: 4821.07 BBB'),
    ).toBeVisible()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('route times', () => {
  it('renders the three route times as distinct magnitudes', async () => {
    const { recommended } = await renderResults()
    expect(recommended).toHaveTextContent('Expected time: 600 s (~10 min)')
    expect(recommended).toHaveTextContent('Conservative time: 900 s (~15 min)')
    expect(recommended).toHaveTextContent('Fiat available in: 1200 s (~20 min)')
  })

  it('keeps each alternative with its own expires_at', async () => {
    await renderResults()
    const alternative = screen.getByRole('region', { name: 'Alternative #1' })
    expect(alternative).toHaveTextContent('Expires: 2026-07-17T11:58:00Z')
    expect(alternative).not.toHaveTextContent('2026-07-17T11:59:30Z')
  })
})

describe('latency detail', () => {
  async function openLatency() {
    const { user, recommended } = await renderResults()
    await user.click(
      within(recommended).getByRole('button', { name: /Latency detail/ }),
    )
    return recommended
  }

  it('renders observed, declarative and fallback legs exactly as received', async () => {
    const recommended = await openLatency()
    const items = within(recommended)
      .getAllByText(/Latency data:/)
      .map((node) => node.textContent)
    expect(items).toContain('Latency data: declarative')
    expect(items).toContain('Latency data: observed')
    expect(items).toContain(
      'Latency data: fallback (observed evidence rejected; declarative times kept)',
    )
    expect(
      within(recommended).getByText('Fallback reason code: evidence_stale'),
    ).toBeVisible()
  })

  it('shows evidence dates only on the observed leg', async () => {
    const recommended = await openLatency()
    const dates = within(recommended).getAllByText(/Observed as of/)
    expect(dates).toHaveLength(1)
    expect(dates[0]).toHaveTextContent(
      'Observed as of 2026-07-01, valid until 2026-08-01',
    )
    // The declarative and fallback legs never show dates: the only leg
    // mentioning the evidence window is the observed one.
    expect(
      within(recommended).getAllByText(/2026-07-01/),
    ).toHaveLength(1)
  })

  it('labels a confirmation target as a chain confirmation, never fiat availability', async () => {
    const recommended = await openLatency()
    const target = within(recommended).getByText(/Chain confirmation target: safe/)
    expect(target).toBeVisible()
    expect(target).toHaveTextContent(
      'a blockchain assurance level, not fiat availability',
    )
    // Exactly one leg (the chain_confirmation one) carries a target.
    expect(
      within(recommended).getAllByText(/Chain confirmation target:/),
    ).toHaveLength(1)
  })
})

describe('methodology link and copy rules', () => {
  it('links from the results to the Methodology page and the link works', async () => {
    const { user } = await renderResults()
    const link = screen.getByRole('link', {
      name: 'How to read these figures — Methodology',
    })
    expect(link).toHaveAttribute('href', '/methodology')
    await user.click(link)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Methodology' }),
    ).toBeInTheDocument()
  })

  it('never shows "p95" or an execution CTA on results or methodology', async () => {
    const { user } = await renderResults()
    expect(document.body.textContent).not.toMatch(/p95/i)
    expect(document.body.textContent).not.toMatch(
      /send money|transfer now|pay now/i,
    )
    await user.click(
      screen.getByRole('link', { name: 'How to read these figures — Methodology' }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Methodology' })
    expect(document.body.textContent).not.toMatch(/p95/i)
    expect(document.body.textContent).not.toMatch(
      /send money|transfer now|pay now/i,
    )
  })

  it('keeps the simulation disclaimer visible alongside the detailed results', async () => {
    const { user, recommended } = await renderResults()
    await user.click(
      within(recommended).getByRole('button', { name: /Leg breakdown/ }),
    )
    const notices = screen.getAllByText(
      'Simulation only. Strateva does not execute, custody or transmit funds.',
    )
    expect(notices.length).toBeGreaterThanOrEqual(1)
    for (const notice of notices) expect(notice).toBeVisible()
  })

  it('uses no localStorage, sessionStorage or cookies through the detailed flow', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { user, recommended } = await renderResults()
    await user.click(
      within(recommended).getByRole('button', { name: /Latency detail/ }),
    )
    await waitFor(() =>
      expect(within(recommended).getByText(/Per-leg latency/)).toBeVisible(),
    )
    expect(setItem).not.toHaveBeenCalled()
    expect(document.cookie).toBe('')
    setItem.mockRestore()
  })
})
