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

describe('renderRouteHtml (build-time per-route HTML)', () => {
  const template = [
    '<html lang="en"><head>',
    '<title>OLD</title>',
    '<meta name="description" content="OLD" />',
    '<link rel="canonical" href="OLD" />',
    '<meta property="og:title" content="OLD" />',
    '<meta property="og:description" content="OLD" />',
    '<meta property="og:url" content="OLD" />',
    '<meta name="twitter:title" content="OLD" />',
    '<meta name="twitter:description" content="OLD" />',
    '</head><body></body></html>',
  ].join('\n')

  it('injects a route-specific title, description, canonical and OG/Twitter tags', async () => {
    const { renderRouteHtml } = await import('../lib/meta')
    const meta = PAGE_META.find((m) => m.path === '/methodology')!
    const html = renderRouteHtml(template, meta)
    expect(html).toContain(`<title>${meta.title}</title>`)
    expect(html).toContain(`name="description" content="${meta.description}"`)
    expect(html).toContain(
      `rel="canonical" href="${CANONICAL_ORIGIN}/methodology"`,
    )
    expect(html).toContain(`property="og:title" content="${meta.title}"`)
    expect(html).toContain(
      `property="og:url" content="${CANONICAL_ORIGIN}/methodology"`,
    )
    expect(html).toContain(`name="twitter:title" content="${meta.title}"`)
    expect(html).not.toContain('OLD</title>')
  })

  it('escapes HTML-special characters in injected values', async () => {
    const { renderRouteHtml } = await import('../lib/meta')
    const html = renderRouteHtml(template, {
      path: '/x',
      title: 'A & B <C> "D"',
      description: 'desc & <tag> "q"',
    })
    expect(html).toContain('<title>A &amp; B &lt;C&gt; &quot;D&quot;</title>')
    expect(html).toContain(
      'name="description" content="desc &amp; &lt;tag&gt; &quot;q&quot;"',
    )
  })
})
