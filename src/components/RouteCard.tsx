import { useId, useState, type ReactNode } from 'react'
import type { PublicRouteResult } from '../api/schemas'
import { formatSeconds } from '../lib/format'

/** A single label/value metric tile. Label and value are separate elements for
 * visual hierarchy, but kept on one text run (with a real space between them)
 * so the exact "Label: value" copy stays matchable and screen-reader friendly. */
function Metric({
  label,
  value,
  primary = false,
}: {
  label: string
  value: string
  primary?: boolean
}) {
  return (
    <li className={primary ? 'metric metric--primary' : 'metric'}>
      <span className="metric-label">{label}</span>{' '}
      <span className="metric-value">{value}</span>
    </li>
  )
}

/** Keyboard-accessible disclosure: a real button with aria-expanded that
 * toggles a labelled region. */
function CollapsibleSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="collapsible">
      <button
        type="button"
        className="collapsible-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
      </button>
      {open && (
        <div id={id} className="collapsible-body">
          {children}
        </div>
      )}
    </div>
  )
}

function StepsList({ route }: { route: PublicRouteResult }) {
  return (
    <ol className="step-list">
      {route.steps.map((step) => {
        const inAsset = step.source_node.asset
        const outAsset = step.destination_node.asset
        return (
          <li key={step.position}>
            <p className="step-title">
              Leg {step.position}: {step.operation_type} via {step.provider}
            </p>
            <ul>
              <li>
                From {inAsset}
                {step.source_node.network ? ` on ${step.source_node.network}` : ''} to{' '}
                {outAsset}
                {step.destination_node.network
                  ? ` on ${step.destination_node.network}`
                  : ''}
              </li>
              <li>
                In: {step.amount_in} {inAsset} → Out: {step.amount_out} {outAsset}
              </li>
              <li>
                Fixed fee: {step.fixed_fee} {inAsset} · Percentage fee:{' '}
                {step.percentage_fee_amount} {inAsset}
              </li>
              <li>
                Spread cost: {step.spread_cost} {outAsset}
              </li>
              <li>
                Time: {formatSeconds(step.estimated_time_seconds)} · Reliability:{' '}
                {step.reliability_score}
              </li>
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

function availabilityLabel(availability: 'continuous' | 'banking_hours'): string {
  return availability === 'continuous' ? 'continuous (24/7)' : 'banking hours'
}

/** The provenance is presented exactly as the API reports it — declarative
 * data is never called observed. */
function provenanceLabel(
  provenance: 'observed' | 'declarative' | 'fallback',
): string {
  if (provenance === 'observed') return 'observed'
  if (provenance === 'fallback') {
    return 'fallback (observed evidence rejected; declarative times kept)'
  }
  return 'declarative'
}

function LatencyDetail({ route }: { route: PublicRouteResult }) {
  return (
    <>
      <h4>Per-component totals</h4>
      <ul className="latency-list">
        {route.latency_breakdown.map((entry) => (
          <li key={entry.component}>
            {entry.component}: expected {formatSeconds(entry.expected_seconds)},
            conservative {formatSeconds(entry.conservative_seconds)}
          </li>
        ))}
      </ul>
      <h4>Per-leg latency</h4>
      <ul className="latency-list">
        {route.latency_legs.map((leg) => (
          <li key={`${leg.position}-${leg.edge_id}`}>
            <p className="step-title">
              Leg {leg.position} · {leg.component} · {leg.provider}
            </p>
            <ul>
              <li>
                Expected {formatSeconds(leg.expected_seconds)} · Conservative{' '}
                {formatSeconds(leg.conservative_seconds)}
              </li>
              <li>Availability: {availabilityLabel(leg.availability)}</li>
              <li>Latency data: {provenanceLabel(leg.provenance)}</li>
              {leg.provenance === 'observed' && leg.as_of !== null && (
                <li>
                  Observed as of {leg.as_of}
                  {leg.valid_until !== null ? `, valid until ${leg.valid_until}` : ''}
                </li>
              )}
              {leg.provenance === 'fallback' && leg.fallback_reason !== null && (
                <li>Fallback reason code: {leg.fallback_reason}</li>
              )}
              {leg.confirmation_target !== null && (
                <li>
                  Chain confirmation target: {leg.confirmation_target} — a
                  blockchain assurance level, not fiat availability.
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function RouteCard({
  title,
  route,
  sourceCurrency,
  destinationCurrency,
  variant = 'alternative',
}: {
  title: string
  route: PublicRouteResult
  sourceCurrency: string
  destinationCurrency: string
  variant?: 'recommended' | 'alternative'
}) {
  const recommended = variant === 'recommended'
  return (
    <section
      className={`route-card route-card--${variant}`}
      aria-label={title}
    >
      <div className="route-card-head">
        <h3 className="route-title">{title}</h3>
        {recommended && (
          <span className="route-flag">Best match for your objective</span>
        )}
      </div>

      {/* Every figure comes verbatim from the validated API response; the UI
          never computes, invents or fills in a missing value. */}
      <ul className="route-metrics">
        <Metric
          label="Receives (approx.):"
          value={`${route.estimated_received_amount} ${destinationCurrency}`}
          primary
        />
        <Metric
          label="Total cost:"
          value={`${route.total_cost} ${destinationCurrency} (${route.total_cost_percentage} %)`}
          primary
        />
        <Metric
          label="Fiat available in:"
          value={formatSeconds(route.time_to_fiat_available_seconds)}
          primary
        />
        <Metric
          label="Effective FX rate (simulated):"
          value={`${route.effective_fx_rate} ${destinationCurrency} per ${sourceCurrency}`}
        />
        <Metric
          label="Expected time:"
          value={formatSeconds(route.expected_time_seconds)}
        />
        <Metric
          label="Conservative time:"
          value={formatSeconds(route.conservative_time_seconds)}
        />
        <Metric label="Reliability:" value={String(route.reliability_score)} />
        <Metric
          label="Operates 24/7:"
          value={route.operates_24_7 ? 'Yes' : 'No'}
        />
        <Metric label="Expires:" value={route.expires_at} />
      </ul>

      <p className="route-why">Why: {route.explanation}</p>

      <CollapsibleSection title="Leg breakdown">
        <StepsList route={route} />
      </CollapsibleSection>
      <CollapsibleSection title="Latency detail">
        <LatencyDetail route={route} />
      </CollapsibleSection>
      {route.warnings.length > 0 && (
        <ul className="route-warnings">
          {route.warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
