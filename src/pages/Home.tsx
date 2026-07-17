import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <h1>Strateva Payment Router</h1>
      <p>
        Strateva is an experimental, public <strong>route simulator</strong>{' '}
        for international payments. It models payment infrastructures as a
        graph and explains how a route can be chosen by comparing{' '}
        <strong>cost, time and reliability</strong> — all within a
        simulation.
      </p>
      <p>
        It is a laboratory, not a money-transfer product: nothing here
        executes, custodies, converts or transmits funds.
      </p>
      <p>
        <Link className="cta" to="/simulator">
          Compare routes
        </Link>
      </p>
    </>
  )
}
