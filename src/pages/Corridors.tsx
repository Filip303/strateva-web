import { toApiError } from '../api/errors'
import { useCorridors } from '../api/hooks'
import { corridorLabel } from '../lib/format'

export default function Corridors() {
  const corridors = useCorridors()
  const corridorList = corridors.data ?? []

  return (
    <>
      <h1>Corridors</h1>
      <p>
        A corridor is an origin-and-destination pair the simulator can model,
        with its own currencies and route families. The list below comes
        exclusively from the public API — nothing is hardcoded.
      </p>

      {corridors.isPending && <p>Loading corridors…</p>}

      {corridors.isError && (
        <div role="alert" className="alert">
          <p>{toApiError(corridors.error).message}</p>
          <button
            type="button"
            className="cta"
            onClick={() => void corridors.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {corridors.isSuccess && corridorList.length === 0 && (
        <p>No corridors are currently available from the API.</p>
      )}

      {corridors.isSuccess && corridorList.length > 0 && (
        <ul>
          {corridorList.map((corridor) => (
            <li key={corridor.corridor_id}>
              {corridorLabel(corridor)}{' '}
              <span className="muted">({corridor.corridor_id})</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
