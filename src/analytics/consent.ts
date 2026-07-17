/**
 * Analytics consent state (GDPR/ePrivacy: opt-in, prior consent).
 *
 * The ONLY persistent value this site stores is this consent preference — a
 * single non-personal flag — so the user's choice survives reloads. No amounts,
 * API responses or personal data are ever stored (see AGENTS.md). Analytics
 * (Google Tag Manager) load ONLY after an explicit `granted` choice; until then,
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
