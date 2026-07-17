export default function Methodology() {
  return (
    <>
      <h1>Methodology</h1>
      <p>Routes are compared along three dimensions:</p>
      <h2>Cost</h2>
      <p>
        What the route costs end to end: fixed fees, percentage fees and the
        foreign-exchange spread, always shown with their currency.
      </p>
      <h2>Time</h2>
      <p>
        How long until the receiver holds spendable money. The simulator
        distinguishes an expected time from a conservative bound, and chain
        confirmation from fiat actually being available.
      </p>
      <h2>Reliability</h2>
      <p>
        A simulated score of how likely the route is to complete without
        incident, aggregated from each leg.
      </p>
      <p className="muted">
        The exact scoring and the meaning of each figure are documented in the
        product contract. All data is synthetic; no figure on this site is a
        real market observation.
      </p>
    </>
  )
}
