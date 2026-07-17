import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { applyMeta } from '../lib/meta'
import { openConsentPreferences } from '../analytics/consent'
import ConsentBanner from './ConsentBanner'

export const SIMULATION_NOTICE =
  'Simulation only. Strateva does not execute, custody or transmit funds.'

const NAV_ITEMS: ReadonlyArray<readonly [path: string, label: string]> = [
  ['/', 'Home'],
  ['/simulator', 'Simulator'],
  ['/how-it-works', 'How it works'],
  ['/corridors', 'Corridors'],
  ['/methodology', 'Methodology'],
  ['/about', 'About'],
]

const LEGAL_ITEMS: ReadonlyArray<readonly [path: string, label: string]> = [
  ['/legal/legal-notice', 'Legal notice'],
  ['/legal/privacy', 'Privacy'],
  ['/legal/cookies', 'Cookies'],
]

export default function Layout() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const isFirstRender = useRef(true)

  // Per-page metadata (title, description, canonical, OG/Twitter, robots)
  // updates on every SPA navigation.
  useEffect(() => {
    applyMeta(location.pathname)
  }, [location.pathname])

  // Accessible SPA navigation: move focus to the main landmark on route
  // changes — but never steal focus on the initial page load.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [location.pathname])

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <p className="sim-notice" role="note">
        {SIMULATION_NOTICE}
      </p>
      <header className="site-header">
        <Link className="brand" to="/">
          Strateva Payment Router
        </Link>
        <nav aria-label="Main">
          <ul className="nav-list">
            {NAV_ITEMS.map(([path, label]) => (
              <li key={path}>
                <NavLink to={path} end={path === '/'}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <nav aria-label="Legal">
          <ul className="nav-list">
            {LEGAL_ITEMS.map(([path, label]) => (
              <li key={path}>
                <Link to={path}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>
          <button
            type="button"
            className="link-button"
            onClick={openConsentPreferences}
          >
            Privacy choices
          </button>
        </p>
        <p>{SIMULATION_NOTICE}</p>
      </footer>
      <ConsentBanner />
    </div>
  )
}
