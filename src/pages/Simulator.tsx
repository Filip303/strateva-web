import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { requestQuote } from '../api/client'
import { toApiError } from '../api/errors'
import { useCorridors } from '../api/hooks'
import { OBJECTIVE_LABELS, OBJECTIVES, type Objective } from '../api/schemas'
import { SIMULATION_NOTICE } from '../components/Layout'
import RouteCard from '../components/RouteCard'
import { corridorLabel } from '../lib/format'
import { useRetryCountdown } from '../lib/useRetryCountdown'

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/

/** Positive-decimal check on the raw STRING — no Number/parseFloat/parseInt:
 * the exact text is preserved and float underflow can never turn a tiny
 * positive amount into zero. Positive = valid format + at least one non-zero
 * digit (rejects '0', '0.0', '000.000', …). */
function isPositiveDecimalString(value: string): boolean {
  return AMOUNT_PATTERN.test(value) && /[1-9]/.test(value)
}

export default function Simulator() {
  const corridors = useCorridors()
  const [corridorId, setCorridorId] = useState('')
  const [amount, setAmount] = useState('')
  const [objective, setObjective] = useState<Objective>('balanced')
  const [formError, setFormError] = useState<string | null>(null)
  const outcomeRef = useRef<HTMLDivElement>(null)

  const quote = useMutation({
    mutationFn: requestQuote,
    retry: false,
  })

  // Retry-After countdowns (manual retry only): the submit button stays
  // disabled after a rate-limited quote, and the corridors Retry button
  // stays disabled after a rate-limited corridors load.
  const retrySeconds = useRetryCountdown(quote.error)
  const corridorsRetrySeconds = useRetryCountdown(corridors.error)

  // Move focus to the outcome block when the request settles.
  useEffect(() => {
    if (quote.status === 'success' || quote.status === 'error') {
      outcomeRef.current?.focus()
    }
  }, [quote.status])

  const corridorList = corridors.data ?? []
  const selected =
    corridorList.find((c) => c.corridor_id === corridorId) ?? corridorList[0]

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    const trimmed = amount.trim()
    if (!isPositiveDecimalString(trimmed)) {
      setFormError('Enter an amount greater than zero.')
      return
    }
    setFormError(null)
    // Countries and currencies always derive from the selected corridor —
    // they are never separately editable and nothing else is sent.
    quote.mutate({
      origin_country: selected.origin_country,
      destination_country: selected.destination_country,
      source_currency: selected.source_currency,
      destination_currency: selected.destination_currency,
      amount: trimmed,
      objective,
    })
  }

  const quoteError = quote.isError ? toApiError(quote.error) : null
  const data = quote.data

  return (
    <>
      <h1>Simulator</h1>
      <p className="muted">
        Compare simulated routes for an amount and an objective. Every figure
        comes from the public API and is synthetic. Advanced options (limits
        and exclusions) arrive in a later change.
      </p>

      {corridors.isPending && <p>Loading corridors…</p>}
      {corridors.isError && (
        <div role="alert" className="alert">
          <p>{toApiError(corridors.error).message}</p>
          {corridorsRetrySeconds > 0 && (
            <p>You can retry in {corridorsRetrySeconds} s (manual retry only).</p>
          )}
          <button
            type="button"
            className="cta"
            disabled={corridorsRetrySeconds > 0}
            onClick={() => void corridors.refetch()}
          >
            Retry
          </button>
        </div>
      )}
      {corridors.isSuccess && corridorList.length === 0 && (
        <p>No corridors are currently available from the API.</p>
      )}

      {corridors.isSuccess && corridorList.length > 0 && selected && (
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="corridor">Corridor</label>
            <select
              id="corridor"
              value={selected.corridor_id}
              onChange={(event) => setCorridorId(event.target.value)}
            >
              {corridorList.map((corridor) => (
                <option key={corridor.corridor_id} value={corridor.corridor_id}>
                  {corridorLabel(corridor)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="amount">Amount ({selected.source_currency})</label>
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <fieldset className="field">
            <legend>Objective</legend>
            {OBJECTIVES.map((value) => (
              <label key={value} className="radio-option">
                <input
                  type="radio"
                  name="objective"
                  value={value}
                  checked={objective === value}
                  onChange={() => setObjective(value)}
                />{' '}
                {OBJECTIVE_LABELS[value]}
              </label>
            ))}
          </fieldset>

          {formError && (
            <div role="alert" className="alert">
              {formError}
            </div>
          )}

          <button
            type="submit"
            className="cta"
            disabled={quote.isPending || retrySeconds > 0}
          >
            Compare routes
          </button>
          <p className="sim-inline-note">⚠ {SIMULATION_NOTICE}</p>
        </form>
      )}

      <div id="quote-outcome" ref={outcomeRef} tabIndex={-1}>
        <p aria-live="polite" className="loading-status">
          {quote.isPending ? 'Comparing simulated routes…' : ''}
        </p>

        {quoteError && (
          <div role="alert" className="alert">
            <p>{quoteError.message}</p>
            {retrySeconds > 0 && (
              <p>You can retry in {retrySeconds} s (manual retry only).</p>
            )}
          </div>
        )}

        {data && (
          <section aria-label="Results" className="results">
            <h2>Results</h2>
            <p className="sim-inline-note">⚠ {data.disclaimer}</p>
            <p>
              Sent: {data.sent_amount} {data.source_currency} →{' '}
              {data.destination_currency}
            </p>
            <p>Objective: {OBJECTIVE_LABELS[data.objective]}</p>
            <p>Recommended route valid until: {data.quote_expires_at}</p>
            <p>
              <Link to="/methodology">
                How to read these figures — Methodology
              </Link>
            </p>
            <RouteCard
              title="Recommended"
              route={data.recommended_route}
              sourceCurrency={data.source_currency}
              destinationCurrency={data.destination_currency}
            />
            {data.alternative_routes.length > 0 && (
              <>
                <h3 className="muted">
                  Alternatives — each expires at its own time
                </h3>
                {data.alternative_routes.map((route, index) => (
                  <RouteCard
                    key={route.route_id}
                    title={`Alternative #${index + 1}`}
                    route={route}
                    sourceCurrency={data.source_currency}
                    destinationCurrency={data.destination_currency}
                  />
                ))}
              </>
            )}
            {data.warnings.length > 0 && (
              <ul className="route-warnings">
                {data.warnings.map((warning) => (
                  <li key={warning}>⚠ {warning}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  )
}
