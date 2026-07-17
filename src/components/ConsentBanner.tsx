import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CONSENT_EVENT,
  clearAnalyticsCookies,
  readConsent,
  reloadPage,
  writeConsent,
  type ConsentState,
} from '../analytics/consent'
import { loadGtm } from '../analytics/gtm'

/**
 * Opt-in analytics consent banner.
 *
 * Shows on first visit until the visitor chooses, and re-opens on demand via
 * the permanent "Privacy choices" footer control (the CONSENT_EVENT). Analytics
 * (Google Tag Manager) load ONLY on an explicit "Accept" — never before, and
 * never on "Reject". Withdrawing a previously granted consent is as easy as
 * granting it: it stores "denied", drops GA's first-party cookies and reloads
 * so the already-executed GTM/GA script and state are discarded and not loaded
 * again. This is the prior-consent + easy-withdrawal mechanism required by
 * GDPR/ePrivacy.
 */
export default function ConsentBanner() {
  const [state, setState] = useState<ConsentState>('unset')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = readConsent()
    setState(stored)
    if (stored === 'granted') {
      loadGtm()
    }
  }, [])

  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener(CONSENT_EVENT, onOpen)
    return () => window.removeEventListener(CONSENT_EVENT, onOpen)
  }, [])

  const visible = state === 'unset' || open
  if (!visible) {
    return null
  }

  function accept() {
    writeConsent('granted')
    loadGtm()
    setState('granted')
    setOpen(false)
  }

  function reject() {
    const wasGranted = state === 'granted'
    writeConsent('denied')
    if (wasGranted) {
      // Withdrawing an active consent: drop GA's first-party cookies and reload
      // so the already-loaded GTM/GA script and its dataLayer are discarded. On
      // reload, consent is "denied", so GTM is not requested again.
      clearAnalyticsCookies()
      reloadPage()
      return
    }
    setState('denied')
    setOpen(false)
  }

  const active = state === 'granted'

  return (
    <div className="consent-banner" role="dialog" aria-label="Analytics consent">
      <p className="consent-text">
        Strateva uses Google Tag Manager (which loads Google Analytics) for
        anonymous audience measurement, loaded only if you accept.{' '}
        {active
          ? 'Analytics are currently ON — you can withdraw at any time.'
          : 'You can change this at any time via “Privacy choices” in the footer.'}{' '}
        See our <Link to="/legal/cookies">Cookies policy</Link> and{' '}
        <Link to="/legal/privacy">Privacy policy</Link>.
      </p>
      <div className="consent-actions">
        <button type="button" className="cta" onClick={accept}>
          Accept analytics
        </button>
        <button
          type="button"
          className="cta consent-secondary"
          onClick={reject}
        >
          {active ? 'Withdraw consent' : 'Reject'}
        </button>
      </div>
    </div>
  )
}
