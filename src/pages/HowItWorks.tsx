import { Link } from 'react-router-dom'

export default function HowItWorks() {
  return (
    <>
      <h1>How it works</h1>
      <p>
        Strateva models the ways money can travel internationally — bank
        transfers, payment providers, foreign exchange, stablecoin rails — as
        a graph of nodes and edges.
      </p>
      <p>
        For a simulated payment, the engine enumerates the viable routes,
        prices each one end to end, and explains why one is recommended over
        the others according to the chosen objective.
      </p>
      <p>
        For routes that cross a blockchain, reaching an on-chain confirmation
        is only an intermediate step — the money still has to leave the chain
        and be paid out. The headline time is always when fiat is actually
        available in the destination bank.
      </p>
      <p className="muted">
        Every provider, fee, rate, time and reliability figure in the
        simulation is synthetic. The simulator shows how such a decision can
        be made — it never moves money. The exact meaning of each figure is
        explained in the <Link to="/methodology">Methodology</Link>.
      </p>
    </>
  )
}
