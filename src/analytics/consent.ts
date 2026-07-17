/**
 * Analytics consent state (GDPR/ePrivacy: opt-in, prior consent).
 *
 * The ONLY persistent value this site stores is this consent preference — a
 * single non-personal flag — so the user's choice survives reloads. No amounts,
 * API responses or personal data are ever stored (see AGENTS.md). Analytics
 * (Google Analytics 4) load ONLY after an explicit `granted` choice; until then,
 * and on `denied`, nothing is loaded and no analytics cookie is set.
 */

export const CONSENT_STORAGE_KEY = 'strateva-analytics-consent'

export type ConsentChoice = 'granted' | 'denied'
export type ConsentState = ConsentChoice | 'unset'

/** Read the stored choice; `unset` if absent, invalid, or storage is unavailable. */
export function readConsent(): ConsentState {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY)
    return value === 'granted' || value === 'denied' ? value : 'unset'
  } catch {
    return 'unset'
  }
}

/** Persist the user's explicit choice. Best-effort; storage may be unavailable. */
export function writeConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice)
  } catch {
    // Private mode / storage disabled: the choice simply won't persist, and the
    // banner will ask again next visit. Never throw from a consent write.
  }
}

/**
 * Event that asks the (always-mounted) consent banner to re-open its
 * preferences, so a permanent "Privacy choices" control can let the visitor
 * change a previous decision as easily as they made it.
 */
export const CONSENT_EVENT = 'strateva:open-consent'

/** Ask the consent banner to re-open (dispatched by the footer control). */
export function openConsentPreferences(): void {
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

/**
 * Reload the page. Wrapped in a module function (rather than calling
 * `window.location.reload()` inline) so consent-withdrawal can be asserted in
 * unit tests without redefining the non-configurable `location.reload`.
 */
export function reloadPage(): void {
  window.location.reload()
}

/**
 * Best-effort removal of Google Analytics' first-party cookies (`_ga` and
 * `_ga_*`) when consent is withdrawn. Only those exact names are touched — no
 * other cookie or stored value is affected. Expiry is attempted across the
 * paths/domains GA may have used; entries that don't match are simply ignored
 * by the browser. Never throws.
 */
export function clearAnalyticsCookies(): void {
  try {
    const names = document.cookie
      .split(';')
      .map((entry) => entry.split('=')[0].trim())
      .filter((name) => name === '_ga' || name.startsWith('_ga_'))

    const host = window.location.hostname
    const registrable = host.split('.').slice(-2).join('.')
    const domains = ['', host, `.${host}`]
    if (registrable && registrable !== host) domains.push(`.${registrable}`)

    for (const name of names) {
      for (const domain of domains) {
        const scope = domain ? `; domain=${domain}` : ''
        document.cookie = `${name}=; path=/; max-age=0${scope}`
      }
    }
  } catch {
    // Cookies unavailable: nothing to clear. Never throw.
  }
}
