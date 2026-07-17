import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { CANONICAL_ORIGIN, PAGE_META } from '../lib/meta'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function headMeta(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null
}

describe('per-page metadata', () => {
  it.each(PAGE_META.map((m) => [m.path, m.title] as const))(
    'sets the title and canonical for %s',
    async (path, title) => {
      renderAt(path)
      await waitFor(() => expect(document.title).toBe(title))
      expect(
        document.head
          .querySelector('link[rel="canonical"]')
          ?.getAttribute('href'),
      ).toBe(`${CANONICAL_ORIGIN}${path}`)
      expect(headMeta('meta[name="description"]')).toBeTruthy()
      expect(headMeta('meta[property="og:title"]')).toBe(title)
      expect(headMeta('meta[name="twitter:card"]')).toBe('summary_large_image')
      expect(document.documentElement.getAttribute('lang')).toBe('en')
      // Indexable pages never carry robots noindex.
      expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
    },
  )

  it('marks the 404 page noindex', async () => {
    renderAt('/definitely-not-a-page')
    await waitFor(() =>
      expect(document.title).toBe('Page not found — Strateva Payment Router'),
    )
    expect(headMeta('meta[name="robots"]')).toBe('noindex')
  })

  it('updates title and description when navigating inside the SPA', async () => {
    renderAt('/')
    await waitFor(() =>
      expect(document.title).toBe('Strateva Payment Router — Simulation Lab'),
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Methodology' }))
    await waitFor(() =>
      expect(document.title).toBe('Methodology — Strateva Payment Router'),
    )
    expect(headMeta('meta[name="description"]')).toMatch(/simulated figures/)
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe(`${CANONICAL_ORIGIN}/methodology`)
  })
})

describe('navigation focus', () => {
  it('does not steal focus on the initial load', async () => {
    renderAt('/')
    await waitFor(() =>
      expect(document.title).toBe('Strateva Payment Router — Simulation Lab'),
    )
    expect(document.activeElement).toBe(document.body)
  })

  it('moves focus to the main landmark after SPA navigation', async () => {
    renderAt('/')
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Methodology' }))
    await waitFor(() =>
      expect(screen.getByRole('main')).toHaveFocus(),
    )
  })
})
