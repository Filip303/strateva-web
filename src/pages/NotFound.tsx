import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>The page you asked for does not exist.</p>
      <p>
        You can go back to the <Link to="/">Home</Link> page or open the{' '}
        <Link to="/simulator">Simulator</Link>.
      </p>
    </>
  )
}
