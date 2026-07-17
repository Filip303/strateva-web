import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CORRIDOR_OPTION_LABEL, corridorsFixture } from './fixtures'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderCorridors() {
  return render(
    <MemoryRouter initialEntries={['/corridors']}>
      <App />
    </MemoryRouter>,
  )
}

describe('corridors page', () => {
  it('shows a loading state while the list is pending', () => {
    // Default setup stub never resolves → the query stays pending.
    renderCorridors()
    expect(screen.getByText('Loading corridors…')).toBeInTheDocument()
  })

  it('renders the dynamic list from the API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(corridorsFixture)),
    )
    renderCorridors()
    expect(await screen.findByText(CORRIDOR_OPTION_LABEL, { exact: false })).toBeVisible()
    expect(screen.getByText('(aaa_bbb)')).toBeInTheDocument()
    // Nothing hardcoded: no real-world corridor appears.
    expect(document.body.textContent).not.toMatch(/\b(EUR|MXN|GBP)\b/)
  })

  it('shows the empty state for an empty list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    )
    renderCorridors()
    expect(
      await screen.findByText('No corridors are currently available from the API.'),
    ).toBeInTheDocument()
  })

  it('shows a sanitized error and retries only manually', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) throw new TypeError('failed to fetch')
        return jsonResponse(corridorsFixture)
      }),
    )
    renderCorridors()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The simulation service could not be reached.')
    expect(calls).toBe(1)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText(CORRIDOR_OPTION_LABEL, { exact: false }),
    ).toBeVisible()
    expect(calls).toBe(2)
  })
})

describe('corridors page rate limiting (Retry-After)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks Retry for Retry-After seconds; only a manual click refetches', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) {
          return new Response(JSON.stringify({}), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '2',
            },
          })
        }
        return jsonResponse(corridorsFixture)
      }),
    )
    vi.useFakeTimers()
    renderCorridors()
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

    fireEvent.click(retry)
    expect(calls).toBe(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(retry).toBeDisabled()
    fireEvent.click(retry)
    expect(calls).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(retry).toBeEnabled()
    expect(calls).toBe(1)
    vi.useRealTimers()
    fireEvent.click(retry)
    expect(
      await screen.findByText(CORRIDOR_OPTION_LABEL, { exact: false }),
    ).toBeVisible()
    expect(calls).toBe(2)
  })
})
