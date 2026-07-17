export default function Corridors() {
  return (
    <>
      <h1>Corridors</h1>
      <p>
        A corridor is an origin-and-destination pair the simulator can model,
        with its own currencies and route families.
      </p>
      <p className="muted">
        Available corridors will be loaded from the public API in the next
        functional change. No corridor is hardcoded in this page: what you
        will see here always comes from the API.
      </p>
    </>
  )
}
