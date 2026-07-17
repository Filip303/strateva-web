import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  CORRIDOR_OPTION_LABEL,
  corridorsFixture,
  makeQuoteResponse,
} from './fixtures'

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
}

type Handler = () => Response | Promise<Response>

function installFetch(handlers?: { corridors?: Handler; quote?: Handler }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/api/v1/corridors')) {
      return handlers?.corridors
        ? handlers.corridors()
        : jsonResponse(corridorsFixture)
    }
    if (url.endsWith('/api/v1/routes/quote') && init?.method === 'POST') {
      return handlers?.quote ? handlers.quote() : jsonResponse(makeQuoteResponse())
    }
    throw new TypeError(`Unexpected request in test: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderSimulator() {
  return render(
    <MemoryRouter initialEntries={['/simulator']}>
      <App />
    </MemoryRouter>,
  )
}

async function waitForForm() {
  return await screen.findByRole('option', { name: CORRIDOR_OPTION_LABEL })
}

async function submitQuote(amount = '250') {
  const user = userEvent.setup()
  await waitForForm()
  await user.type(screen.getByLabelText('Amount (AAA)'), amount)
  await user.click(screen.getByRole('button', { name: 'Compare routes' }))
  return user
}

function postCalls(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
  )
}

describe('corridor loading', () => {
  it('renders corridors from the mocked API response, never hardcoded', async () => {
    installFetch()
    renderSimulator()
    await waitForForm()
    // The only corridor visible is the synthetic one from the fixture.
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(document.body.textContent).not.toMatch(/\b(EUR|MXN|GBP)\b/)
  })

  it('shows a sanitized corridors error with manual retry', async () => {
    let failed = false
    const fetchMock = installFetch({
      corridors: () => {
        if (!failed) {
          failed = true
          throw new TypeError('failed to fetch')
        }
        return jsonResponse(corridorsFixture)
      },
    })
    renderSimulator()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The simulation service could not be reached.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    await waitForForm()
    expect(fetchMock.mock.calls.length).toBe(2)
  })
})

describe('quote request', () => {
  it('derives countries and currencies from the selected corridor', async () => {
    const fetchMock = installFetch()
    renderSimulator()
    await submitQuote('250')
    await screen.findByRole('heading', { name: 'Results' })
    const posts = postCalls(fetchMock)
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0][1]?.body as string)).toEqual({
      origin_country: 'AA',
      destination_country: 'BB',
      source_currency: 'AAA',
      destination_currency: 'BBB',
      amount: '250',
      objective: 'balanced',
    })
  })

  it('exposes exactly the four public objective enum values and sends them verbatim', async () => {
    const fetchMock = installFetch()
    renderSimulator()
    await waitForForm()
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.value)).toEqual([
      'cheapest',
      'fastest',
      'most_reliable',
      'balanced',
    ])
    expect(screen.getByLabelText('Prioritize cost')).toBeInTheDocument()
    expect(screen.getByLabelText('Prioritize speed')).toBeInTheDocument()
    expect(screen.getByLabelText('Prioritize reliability')).toBeInTheDocument()
    expect(screen.getByLabelText('Balanced')).toBeChecked()

    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Prioritize speed'))
    await user.type(screen.getByLabelText('Amount (AAA)'), '250')
    await user.click(screen.getByRole('button', { name: 'Compare routes' }))
    await screen.findByRole('heading', { name: 'Results' })
    const body = JSON.parse(postCalls(fetchMock)[0][1]?.body as string)
    expect(body.objective).toBe('fastest')
  })

  it.each(['0', '0.0', '000.000', '-5', 'abc', ''])(
    'does not send a request for invalid amount %j',
    async (badAmount) => {
      const fetchMock = installFetch()
      renderSimulator()
      const user = userEvent.setup()
      await waitForForm()
      if (badAmount !== '') {
        await user.type(screen.getByLabelText('Amount (AAA)'), badAmount)
      }
      await user.click(screen.getByRole('button', { name: 'Compare routes' }))
      expect(
        await screen.findByText('Enter an amount greater than zero.'),
      ).toBeInTheDocument()
      expect(postCalls(fetchMock)).toHaveLength(0)
    },
  )

  it('validates amount as a string: a tiny positive decimal is sent exactly, never via floats', async () => {
    // Number() underflows this to 0, so any float-based validation would
    // wrongly reject it; string validation accepts it and sends it verbatim.
    const tinyPositive = `0.${'0'.repeat(400)}1`
    const fetchMock = installFetch()
    renderSimulator()
    await waitForForm()
    fireEvent.change(screen.getByLabelText('Amount (AAA)'), {
      target: { value: tinyPositive },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Compare routes' }))
    await screen.findByRole('heading', { name: 'Results' })
    const body = JSON.parse(postCalls(fetchMock)[0][1]?.body as string)
    expect(body.amount).toBe(tinyPositive)
  })

  it('disables the button and announces loading while the request is in flight', async () => {
    installFetch({ quote: () => new Promise<never>(() => {}) })
    renderSimulator()
    await submitQuote()
    const button = screen.getByRole('button', { name: 'Compare routes' })
    await waitFor(() => expect(button).toBeDisabled())
    expect(screen.getByText('Comparing simulated routes…')).toBeInTheDocument()
  })

  it('never retries the POST automatically after a server error', async () => {
    const fetchMock = installFetch({
      quote: () => jsonResponse({}, { status: 500 }),
    })
    renderSimulator()
    await submitQuote()
    await screen.findByRole('alert')
    // Give any hypothetical retry a chance to fire, then assert exactly one POST.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(postCalls(fetchMock)).toHaveLength(1)
  })
})

describe('results rendering', () => {
  it('shows no result figures before a quote and only the exact received figures after', async () => {
    installFetch()
    renderSimulator()
    await waitForForm()
    const outcome = document.getElementById('quote-outcome')!
    expect(outcome.textContent).not.toMatch(/\d/)
    expect(screen.queryByText(/4821\.07/)).toBeNull()

    await submitQuote()
    await screen.findByRole('heading', { name: 'Results' })
    expect(screen.getByText(/Receives \(approx\.\): 4821\.07 BBB/)).toBeInTheDocument()
    expect(screen.getByText(/Total cost: 12\.50 BBB \(0\.2590 %\)/)).toBeInTheDocument()
  })

  it('renders recommendation and alternatives with units on every figure', async () => {
    installFetch()
    renderSimulator()
    await submitQuote()
    await screen.findByRole('heading', { name: 'Results' })

    expect(screen.getByText('Sent: 250 AAA → BBB')).toBeInTheDocument()
    expect(screen.getByText('Objective: Balanced')).toBeInTheDocument()
    expect(
      screen.getByText('Recommended route valid until: 2026-07-17T11:59:30Z'),
    ).toBeInTheDocument()

    const recommended = screen.getByRole('region', { name: 'Recommended' })
    expect(recommended).toHaveTextContent('Receives (approx.): 4821.07 BBB')
    expect(recommended).toHaveTextContent('Total cost: 12.50 BBB (0.2590 %)')
    expect(recommended).toHaveTextContent(
      'Effective FX rate (simulated): 19.284280 BBB per AAA',
    )
    expect(recommended).toHaveTextContent('Expected time: 600 s (~10 min)')
    expect(recommended).toHaveTextContent('Conservative time: 900 s (~15 min)')
    expect(recommended).toHaveTextContent('Fiat available in: 900 s (~15 min)')
    expect(recommended).toHaveTextContent('Reliability: 0.98')
    expect(recommended).toHaveTextContent('Operates 24/7: No')
    expect(recommended).toHaveTextContent('Expires: 2026-07-17T12:00:00Z')

    const alternative = screen.getByRole('region', { name: 'Alternative #1' })
    expect(alternative).toHaveTextContent('Receives (approx.): 4790.33 BBB')
    expect(alternative).toHaveTextContent('Total cost: 43.24 BBB')
  })

  it('shows each alternative with its OWN expires_at, distinct from quote_expires_at', async () => {
    installFetch()
    renderSimulator()
    await submitQuote()
    await screen.findByRole('heading', { name: 'Results' })
    const alternative = screen.getByRole('region', { name: 'Alternative #1' })
    expect(alternative).toHaveTextContent('Expires: 2026-07-17T11:58:00Z')
    expect(alternative).not.toHaveTextContent('2026-07-17T11:59:30Z')
  })

  it('moves focus to the outcome block when the request settles', async () => {
    installFetch()
    renderSimulator()
    await submitQuote()
    await screen.findByRole('heading', { name: 'Results' })
    await waitFor(() =>
      expect(document.getElementById('quote-outcome')).toHaveFocus(),
    )
  })

  it('keeps the simulation disclaimer visible with results shown', async () => {
    installFetch()
    renderSimulator()
    await submitQuote()
    await screen.findByRole('heading', { name: 'Results' })
    const notices = screen.getAllByText(
      'Simulation only. Strateva does not execute, custody or transmit funds.',
    )
    expect(notices.length).toBeGreaterThanOrEqual(1)
    for (const notice of notices) expect(notice).toBeVisible()
  })

  it('does not use localStorage, sessionStorage or cookies during the flow', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    installFetch()
    renderSimulator()
    await submitQuote()
    await screen.findByRole('heading', { name: 'Results' })
    expect(setItem).not.toHaveBeenCalled()
    expect(document.cookie).toBe('')
    setItem.mockRestore()
  })
})

describe('safe failure', () => {
  it.each([
    'recommended_route',
    'alternative_routes',
    'provider_failures',
    'quote_expires_at',
  ])('fails safe when required field %s is missing', async (key) => {
    const body = structuredClone(makeQuoteResponse()) as unknown as Record<
      string,
      unknown
    >
    delete body[key]
    installFetch({ quote: () => jsonResponse(body) })
    renderSimulator()
    await submitQuote()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The simulation response could not be safely displayed.',
    )
    expect(screen.queryByText(/4821\.07/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Results' })).toBeNull()
  })

  it('rejects simulation_only: false and renders nothing partial', async () => {
    const body = structuredClone(makeQuoteResponse()) as unknown as Record<
      string,
      unknown
    >
    body.simulation_only = false
    installFetch({ quote: () => jsonResponse(body) })
    renderSimulator()
    await submitQuote()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The simulation response could not be safely displayed.',
    )
    expect(screen.queryByText(/4821\.07/)).toBeNull()
  })
})

describe('error states', () => {
  it.each([
    [404, 'That corridor is unavailable in the simulation.'],
    [422, 'Invalid request, or no viable route exists within the simulation.'],
    [500, 'The simulation is temporarily unavailable. Try again in a moment.'],
    [503, 'The simulation is temporarily unavailable. Try again in a moment.'],
  ])('shows the sanitized message for HTTP %d', async (status, message) => {
    installFetch({ quote: () => jsonResponse({}, { status }) })
    renderSimulator()
    await submitQuote()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
  })

  it('shows the sanitized network-error message', async () => {
    installFetch({
      quote: () => {
        throw new TypeError('failed to fetch')
      },
    })
    renderSimulator()
    await submitQuote()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The simulation service could not be reached.')
  })

  it('never shows the technical body of an error response', async () => {
    installFetch({
      quote: () =>
        jsonResponse({ detail: 'SECRET-TRACEBACK-42' }, { status: 422 }),
    })
    renderSimulator()
    await submitQuote()
    await screen.findByRole('alert')
    expect(screen.queryByText(/SECRET-TRACEBACK-42/)).toBeNull()
  })

  it('respects Retry-After on 429: retry stays blocked, then unblocks', async () => {
    installFetch({
      quote: () =>
        jsonResponse({}, { status: 429, headers: { 'Retry-After': '1' } }),
    })
    renderSimulator()
    await waitForForm()
    fireEvent.change(screen.getByLabelText('Amount (AAA)'), {
      target: { value: '250' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Compare routes' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Too many simulations in a row. Please wait before retrying.',
    )
    const button = screen.getByRole('button', { name: 'Compare routes' })
    expect(button).toBeDisabled()
    expect(screen.getByText(/You can retry in 1 s/)).toBeInTheDocument()
    await waitFor(() => expect(button).toBeEnabled(), { timeout: 3000 })
  })

  it('moves focus to the error block when the request fails', async () => {
    installFetch({ quote: () => jsonResponse({}, { status: 500 }) })
    renderSimulator()
    await submitQuote()
    await screen.findByRole('alert')
    await waitFor(() =>
      expect(document.getElementById('quote-outcome')).toHaveFocus(),
    )
  })
})

describe('corridors rate limiting on the simulator (Retry-After)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks the corridors Retry button for Retry-After seconds; only a manual click refetches', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) {
          return jsonResponse(
            {},
            { status: 429, headers: { 'Retry-After': '2' } },
          )
        }
        return jsonResponse(corridorsFixture)
      }),
    )
    vi.useFakeTimers()
    renderSimulator()
    for (let i = 0; i < 50 && !screen.queryByRole('alert'); i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })
    }
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Too many simulations in a row. Please wait before retrying.',
    )
    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toBeDisabled()
    expect(screen.getByText(/You can retry in 2 s/)).toBeInTheDocument()

    // Clicking while blocked, or advancing less than the full window,
    // sends nothing.
    fireEvent.click(retry)
    expect(calls).toBe(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(retry).toBeDisabled()
    fireEvent.click(retry)
    expect(calls).toBe(1)

    // After the countdown completes the button enables — with NO automatic
    // refetch; only the manual click issues the second GET.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(retry).toBeEnabled()
    expect(calls).toBe(1)
    vi.useRealTimers()
    fireEvent.click(retry)
    await waitForForm()
    expect(calls).toBe(2)
  })
})
