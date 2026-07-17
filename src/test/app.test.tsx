import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { SIMULATION_NOTICE } from '../components/Layout'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const ROUTES: ReadonlyArray<readonly [path: string, heading: string]> = [
  ['/', 'Strateva Payment Router'],
  ['/simulator', 'Simulator'],
  ['/how-it-works', 'How it works'],
  ['/corridors', 'Corridors'],
  ['/methodology', 'Methodology'],
  ['/about', 'About'],
  ['/legal/legal-notice', 'Legal notice'],
  ['/legal/privacy', 'Privacy'],
  ['/legal/cookies', 'Cookies'],
]

const EXECUTION_CTA = /send money|transfer now|pay now/i

describe('routes', () => {
  it.each(ROUTES)('%s renders its English heading', (path, heading) => {
    renderAt(path)
    expect(
      screen.getByRole('heading', { level: 1, name: heading }),
    ).toBeInTheDocument()
  })

  it('renders the 404 page for unknown paths', () => {
    renderAt('/this-route-does-not-exist')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(main.getByRole('link', { name: 'Simulator' })).toHaveAttribute(
      'href',
      '/simulator',
    )
  })
})

describe('simulation notice', () => {
  it.each([...ROUTES.map(([path]) => path), '/this-route-does-not-exist'])(
    'is visible at %s',
    (path) => {
      renderAt(path)
      const notices = screen.getAllByText(SIMULATION_NOTICE)
      expect(notices.length).toBeGreaterThanOrEqual(1)
      for (const notice of notices) {
        expect(notice).toBeVisible()
      }
    },
  )
})

describe('navigation', () => {
  it('uses the approved English paths', () => {
    renderAt('/')
    const expected: ReadonlyArray<readonly [label: string, href: string]> = [
      ['Home', '/'],
      ['Simulator', '/simulator'],
      ['How it works', '/how-it-works'],
      ['Corridors', '/corridors'],
      ['Methodology', '/methodology'],
      ['About', '/about'],
      ['Legal notice', '/legal/legal-notice'],
      ['Privacy', '/legal/privacy'],
      ['Cookies', '/legal/cookies'],
    ]
    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      )
    }
  })
})

describe('copy rules', () => {
  it.each([...ROUTES.map(([path]) => path), '/this-route-does-not-exist'])(
    'has no execution CTA at %s',
    (path) => {
      const { container } = renderAt(path)
      expect(container.textContent).not.toMatch(EXECUTION_CTA)
    },
  )

  it('shows the approved CTA on the home page', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Compare routes' })).toHaveAttribute(
      'href',
      '/simulator',
    )
  })

  // The "no invented figures" regression lives in simulator.test.tsx: before a
  // quote the outcome block shows no figures; after a mocked response only the
  // exact figures received from the API are rendered.
})
