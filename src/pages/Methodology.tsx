import { Link } from 'react-router-dom'

export default function Methodology() {
  return (
    <>
      <h1>Methodology</h1>
      <p>
        How to read the figures the <Link to="/simulator">simulator</Link>{' '}
        shows. Every value comes from the public API and is synthetic — no
        figure on this site is a real market observation, and nothing here
        moves money.
      </p>

      <h2>Total cost</h2>
      <p>
        What the route costs end to end: fixed fees, percentage fees and the
        foreign-exchange spread, added up and expressed in the destination
        currency, plus the same cost as a percentage. Per leg, fixed and
        percentage fees are charged in the leg's input asset and the spread
        cost in its output asset — the breakdown always shows each figure with
        its own asset.
      </p>

      <h2>Simulated effective FX rate</h2>
      <p>
        The rate you effectively get after all costs: the estimated received
        amount divided by the sent amount, in destination units per source
        unit. It is not a market rate and not a mid rate — it is the net
        result of the simulation.
      </p>

      <h2>Expected time</h2>
      <p>
        The route's typical time: the sum of each leg's expected times.
      </p>

      <h2>Conservative time</h2>
      <p>
        A prudent upper bound: the sum of each leg's conservative bounds. It
        is deliberately called "conservative" and not a statistical
        percentile, because no per-leg variance data exists yet — it often
        equals the expected time.
      </p>

      <h2>Time to fiat available</h2>
      <p>
        The (conservative) time until the receiver holds spendable money in
        their destination bank account. This is the figure that matters
        commercially: everything before it is an intermediate step.
      </p>

      <h2>Simulated reliability</h2>
      <p>
        A synthetic score between zero and one of how likely the route is to
        complete without incident, aggregated from each leg. It does not
        reflect any provider's real performance.
      </p>

      <h2>Blockchain confirmation vs. fiat available</h2>
      <p>
        An on-chain leg targets exactly one assurance level: included (in a
        block), safe (justified but still reversible) or finalized
        (irreversible). These are alternative targets, never cumulative
        stages. Reaching a confirmation target is <strong>not</strong> money
        arriving: after it, the off-ramp and the payout still have to happen.
        A fast blockchain with a slow off-ramp still means a late arrival —
        which is why the headline time is "fiat available", never the chain
        confirmation.
      </p>

      <h2>Declarative, observed and fallback latency data</h2>
      <p>
        Each leg says where its timing figures come from, and the site shows
        that provenance exactly as the API reports it:
      </p>
      <ul>
        <li>
          <strong>declarative</strong> — the figure is fixed in the corridor's
          definition; it is not a measurement.
        </li>
        <li>
          <strong>observed</strong> — the figure was substituted with measured
          evidence; only these legs carry the evidence dates.
        </li>
        <li>
          <strong>fallback</strong> — observed evidence existed but was
          rejected (a safe reason code is shown), so the declarative figures
          were kept.
        </li>
      </ul>
      <p className="muted">
        Ranking is relative to the candidate set returned for your request,
        and all of it is a simulation: Strateva does not execute, custody,
        convert or transmit funds.
      </p>
    </>
  )
}
