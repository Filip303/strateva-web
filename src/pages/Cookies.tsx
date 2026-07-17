export default function Cookies() {
  return (
    <>
      <h1>Cookies</h1>
      <p className="muted">
        This page is initial skeleton content, not final professional legal
        advice.
      </p>
      <p>
        By default this website sets <strong>no cookies</strong>. The simulator
        works fully without them.
      </p>
      <h2>Analytics cookies (only if you accept)</h2>
      <p>
        We offer optional audience measurement through Google Analytics. These
        analytics cookies are set{' '}
        <strong>only after you press “Accept analytics”</strong> in the consent
        banner. If you reject, or ignore the banner, none of them are set and no
        analytics script is loaded.
      </p>
      <p>
        These cookies are <strong>not anonymous</strong>: Google Analytics’{' '}
        <code>_ga</code> cookie stores a pseudonymous client identifier used to
        distinguish visitors, and <code>_ga_*</code> holds per-session state. We
        restrict Google Analytics to audience measurement — no advertising,
        remarketing, personalization or Google Signals.
      </p>
      <p>
        Your choice is remembered using a single non-cookie preference stored in
        your browser (<code>strateva-analytics-consent</code>). It records only
        “granted” or “denied” — nothing personal.
      </p>
      <p>
        You can change your mind at any time using the{' '}
        <strong>“Privacy choices”</strong> control in the footer. Withdrawing
        consent stores “denied”, removes Google Analytics’ <code>_ga</code> and{' '}
        <code>_ga_*</code> cookies on a best-effort basis, and reloads the page
        so the analytics script stops running — no need to clear all your site
        data.
      </p>
      <p>
        We set no advertising, personalization or session cookies, and no other
        third-party trackers.
      </p>
    </>
  )
}
