export default function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="muted">
        This page is initial skeleton content, not final professional legal
        advice.
      </p>
      <p>
        The website requires no sign-up and stores no amounts or simulation
        results in your browser. The simulation is ephemeral.
      </p>
      <h2>Analytics (opt-in)</h2>
      <p>
        With your consent, we use Google Tag Manager (which loads Google
        Analytics) for anonymous audience measurement. It loads{' '}
        <strong>only after you press “Accept analytics”</strong> in the consent
        banner; if you reject or ignore it, no analytics script or cookie is
        loaded. The legal basis is your consent, which you can withhold or
        withdraw at any time using the <strong>“Privacy choices”</strong>{' '}
        control in the footer — withdrawing removes Google Analytics’ cookies
        and reloads the page so tracking stops immediately.
      </p>
      <p>
        When enabled, Google Analytics processes standard technical data (such
        as IP address, device and browser, and pages viewed) as a processor on
        our behalf; Google is a third party with its own privacy terms. We do
        not collect names, accounts or payment data — there are none: Strateva
        is a simulation and moves no money.
      </p>
      <p>
        The only value we persist is your consent choice, a single non-personal
        flag (<code>strateva-analytics-consent</code>). We run no advertising or
        cross-site tracking.
      </p>
    </>
  )
}
