import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readConsent, writeConsent, type ConsentState } from '../analytics/consent'
import { loadGtm } from '../analytics/gtm'

/**
 * Opt-in analytics consent banner.
 *
 * Shows only until the visitor makes a choice. Analytics (Google Tag Manager)
 * load ONLY on an explicit "Accept" — never before, and never on "Reject". A
 * previously granted choice re-loads GTM on the next visit; a denied or absent
 * choice loads nothing. This is the prior-consent mechanism required by
 * GDPR/ePrivacy for non-essential cookies.
 */
export default function ConsentBanner() {
  const [state, setState] = useState<ConsentState>('unset')

  useEffect(() => {
    const stored = readConsent()
    setState(stored)
    if (stored === 'granted') {
      loadGtm()
    }
  }, [])

  if (state !== 'unset') {
    return null
  }

  function accept() {
    writeConsent('granted')
    loadGtm()
    setState('granted')
  }

  function reject() {
    writeConsent('denied')
    setState('denied')
  }

  return (
    <div
      className="consent-banner"
      role="dialog"
      aria-label="Analytics consent"
    >
      <p className="consent-text">
        Strateva uses Google Tag Manager (which loads Google Analytics) for
        anonymous audience measurement. These cookies are set only if you
        accept. See our <Link to="/legal/cookies">Cookies policy</Link> and{' '}
        <Link to="/legal/privacy">Privacy policy</Link>. You can reject and keep
        using the simulator.
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
          Reject
        </button>
      </div>
    </div>
  )
}
