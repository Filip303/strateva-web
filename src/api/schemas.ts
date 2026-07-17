/**
 * Zod schemas for the public backend contract.
 *
 * Source of truth: the schema CODE of Filip303/strateva-payment-router at
 * commit a697ca08348d0f1ec19bcb715c7a54ce6dff625f —
 * `api/schemas.py`, `api/public.py`, `domain/models.py`, `domain/enums.py`,
 * `domain/latency.py` and `providers/failures.py`. The repository's
 * `examples/quote-response.json` is outdated and is NOT a source of truth.
 *
 * Decimal amounts arrive as JSON strings and are kept as strings end to end —
 * the UI never parses them into floats, never recalculates them and never
 * invents figures the API did not return.
 *
 * Validation mirrors the contract's own guarantees: exact country/currency
 * lengths, closed enum sets, valid ISO timestamps and dates, bounded scores,
 * non-negative durations, `conservative >= expected`, confirmation targets
 * only (and always) on chain-confirmation legs, and coherent public
 * provenance. Unknown EXTRA fields are tolerated (stripped) for forward
 * compatibility — the contract does not forbid additive fields. A response
 * missing a required field, violating a guarantee, or with `simulation_only`
 * different from `true` fails safe and is never partially rendered.
 */

import { z } from 'zod'

/** Decimal serialized by the backend as a JSON string. Kept verbatim. */
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'expected a decimal string')

/** ISO 3166-1 alpha-2 country code (exactly 2 characters). */
const countryCode = z.string().length(2)

/** ISO 4217 currency code (exactly 3 characters). */
const currencyCode = z.string().length(3)

/** ISO datetime; accepts an offset or 'Z', and a naive timestamp. */
const isoDateTime = z.iso.datetime({ offset: true, local: true })

/** Exact YYYY-MM-DD date (the backend validates the same round-trip form). */
const isoDate = z.iso.date()

const nonNegativeInt = z.number().int().min(0)

/** Dimensionless score the domain bounds to [0, 1]. */
const unitScore = z.number().min(0).max(1)

export const OBJECTIVES = ['cheapest', 'fastest', 'most_reliable', 'balanced'] as const
export const objectiveSchema = z.enum(OBJECTIVES)
export type Objective = z.infer<typeof objectiveSchema>

/** UI labels for the public objective enum (the only hardcoded values). */
export const OBJECTIVE_LABELS: Record<Objective, string> = {
  cheapest: 'Prioritize cost',
  fastest: 'Prioritize speed',
  most_reliable: 'Prioritize reliability',
  balanced: 'Balanced',
}

/** domain/enums.py AccountType — closed set. */
const accountTypeSchema = z.enum([
  'bank_account',
  'provider_balance',
  'onchain',
  'correspondent',
])

/** domain/enums.py OperationType — closed set. */
const operationTypeSchema = z.enum([
  'local_transfer',
  'sepa_transfer',
  'swift_transfer',
  'provider_transfer',
  'fx_conversion',
  'onramp',
  'offramp',
  'onchain_transfer',
  'bridge',
  'local_payout',
])

// --- GET /api/v1/corridors -------------------------------------------------

export const corridorInfoSchema = z.object({
  corridor_id: z.string().min(1),
  origin_country: countryCode,
  destination_country: countryCode,
  source_currency: currencyCode,
  destination_currency: currencyCode,
})
export type CorridorInfo = z.infer<typeof corridorInfoSchema>

export const corridorsResponseSchema = z.array(corridorInfoSchema)

// --- POST /api/v1/routes/quote ----------------------------------------------

/** Body of POST /api/v1/routes/quote (QuoteRequestBody). Amount is sent as a
 * string so the backend's Decimal parsing sees the exact user input. */
export interface QuoteRequestBody {
  origin_country: string
  destination_country: string
  source_currency: string
  destination_currency: string
  amount: string
  objective: Objective
}

const paymentNodeSchema = z.object({
  node_id: z.string(),
  asset: z.string().min(1),
  network: z.string().nullable(),
  country: countryCode.nullable(),
  account_type: accountTypeSchema,
  provider: z.string().nullable(),
  metadata: z.record(z.string(), z.string()),
})

const routeStepSchema = z.object({
  position: nonNegativeInt,
  source_node: paymentNodeSchema,
  destination_node: paymentNodeSchema,
  provider: z.string(),
  operation_type: operationTypeSchema,
  fixed_fee: decimalString,
  percentage_fee_amount: decimalString,
  spread_cost: decimalString,
  estimated_time_seconds: nonNegativeInt,
  reliability_score: unitScore,
  amount_in: decimalString,
  amount_out: decimalString,
})

const latencyComponentSchema = z.enum([
  'funding',
  'onramp',
  'chain_confirmation',
  'bridge',
  'offramp',
  'fiat_payout',
  'bank_settlement',
])

const latencyBreakdownEntrySchema = z
  .object({
    component: latencyComponentSchema,
    expected_seconds: nonNegativeInt,
    conservative_seconds: nonNegativeInt,
  })
  .refine((entry) => entry.conservative_seconds >= entry.expected_seconds, {
    message: 'conservative_seconds must be >= expected_seconds',
  })

const publicLatencyLegSchema = z
  .object({
    position: nonNegativeInt,
    edge_id: z.string(),
    provider: z.string(),
    component: latencyComponentSchema,
    confirmation_target: z.enum(['included', 'safe', 'finalized']).nullable(),
    expected_seconds: nonNegativeInt,
    conservative_seconds: nonNegativeInt,
    availability: z.enum(['continuous', 'banking_hours']),
    basis: z.enum(['operational_duration', 'calendar_elapsed']),
    latency_source: z.enum(['observed', 'declarative']),
    provenance: z.enum(['observed', 'declarative', 'fallback']),
    fallback_reason: z.string().nullable(),
    as_of: isoDate.nullable(),
    valid_until: isoDate.nullable(),
  })
  .superRefine((leg, ctx) => {
    if (leg.conservative_seconds < leg.expected_seconds) {
      ctx.addIssue({
        code: 'custom',
        message: 'conservative_seconds must be >= expected_seconds',
      })
    }
    // A confirmation target exists ONLY (and always) on a chain-confirmation
    // leg (domain/latency.py LatencyProfile invariants).
    if (leg.component === 'chain_confirmation') {
      if (leg.confirmation_target === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'a chain_confirmation leg requires a confirmation_target',
        })
      }
    } else if (leg.confirmation_target !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'confirmation_target is only valid on a chain_confirmation leg',
      })
    }
    // Public provenance coherence (api/public.py _public_leg):
    // observed <-> latency_source 'observed' and carries as_of; fallback means
    // observed evidence was rejected (reason present, times declarative);
    // declarative legs carry no evidence dates and no fallback reason.
    const observed = leg.latency_source === 'observed'
    if ((leg.provenance === 'observed') !== observed) {
      ctx.addIssue({
        code: 'custom',
        message: "provenance 'observed' must match latency_source 'observed'",
      })
    }
    if (leg.provenance === 'fallback' && leg.fallback_reason === null) {
      ctx.addIssue({
        code: 'custom',
        message: "provenance 'fallback' requires a fallback_reason",
      })
    }
    if (leg.provenance === 'declarative' && leg.fallback_reason !== null) {
      ctx.addIssue({
        code: 'custom',
        message: "a declarative leg carries no fallback_reason",
      })
    }
    if (observed && leg.as_of === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'an observed leg must carry an as_of date',
      })
    }
    if (!observed && (leg.as_of !== null || leg.valid_until !== null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'evidence dates are only exposed for observed legs',
      })
    }
  })

export const publicRouteResultSchema = z
  .object({
    route_id: z.string(),
    simulation_only: z.literal(true),
    steps: z.array(routeStepSchema),
    total_cost: decimalString,
    total_cost_percentage: decimalString,
    total_time_seconds: nonNegativeInt,
    expected_time_seconds: nonNegativeInt,
    conservative_time_seconds: nonNegativeInt,
    time_to_fiat_available_seconds: nonNegativeInt,
    latency_breakdown: z.array(latencyBreakdownEntrySchema),
    latency_legs: z.array(publicLatencyLegSchema),
    operates_24_7: z.boolean(),
    effective_fx_rate: decimalString,
    estimated_received_amount: decimalString,
    reliability_score: unitScore,
    objective_score: z.number(),
    expires_at: isoDateTime,
    explanation: z.string(),
    warnings: z.array(z.string()),
  })
  .superRefine((route, ctx) => {
    if (route.conservative_time_seconds < route.expected_time_seconds) {
      ctx.addIssue({
        code: 'custom',
        message: 'conservative time must be >= expected time',
      })
    }
    // Cross-field temporal coherence: the backend derives every one of these
    // fields from the same per-leg latency profiles (domain/models.py,
    // domain/latency.py), so a response violating them cannot have come from
    // the engine. Deliberately NOT enforced: any relation over fees, FX or
    // amounts, and time_to_fiat_available_seconds vs conservative time (not
    // declared as an independent public invariant).
    const sum = (
      entries: ReadonlyArray<{ expected_seconds: number; conservative_seconds: number }>,
      key: 'expected_seconds' | 'conservative_seconds',
    ) => entries.reduce((total, entry) => total + entry[key], 0)

    if (route.total_time_seconds !== route.expected_time_seconds) {
      ctx.addIssue({
        code: 'custom',
        message: 'total_time_seconds must equal expected_time_seconds',
      })
    }
    if (sum(route.latency_breakdown, 'expected_seconds') !== route.expected_time_seconds) {
      ctx.addIssue({
        code: 'custom',
        message: 'latency_breakdown expected sum must equal expected_time_seconds',
      })
    }
    if (
      sum(route.latency_breakdown, 'conservative_seconds') !==
      route.conservative_time_seconds
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'latency_breakdown conservative sum must equal conservative_time_seconds',
      })
    }
    if (sum(route.latency_legs, 'expected_seconds') !== route.expected_time_seconds) {
      ctx.addIssue({
        code: 'custom',
        message: 'latency_legs expected sum must equal expected_time_seconds',
      })
    }
    if (
      sum(route.latency_legs, 'conservative_seconds') !== route.conservative_time_seconds
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'latency_legs conservative sum must equal conservative_time_seconds',
      })
    }
    if (route.steps.length !== route.latency_legs.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'steps and latency_legs must have the same number of entries',
      })
    } else {
      route.steps.forEach((step, index) => {
        if (route.latency_legs[index].position !== step.position) {
          ctx.addIssue({
            code: 'custom',
            message: `latency_legs[${index}].position must match steps[${index}].position`,
          })
        }
      })
    }
  })
export type PublicRouteResult = z.infer<typeof publicRouteResultSchema>

const providerFailureSchema = z.object({
  provider_id: z.string(),
  operation_id: z.string().nullable(),
  category: z.enum([
    'temporary',
    'rate_limit',
    'authentication',
    'invalid_response',
    'unsupported',
  ]),
  retryable: z.boolean(),
  occurred_at: isoDateTime,
  safe_message: z.string(),
})

export const quoteResponseSchema = z.object({
  disclaimer: z.string(),
  simulation_only: z.literal(true),
  generated_at: isoDateTime,
  quote_expires_at: isoDateTime,
  sent_amount: decimalString,
  source_currency: currencyCode,
  destination_currency: currencyCode,
  objective: objectiveSchema,
  recommended_route: publicRouteResultSchema,
  alternative_routes: z.array(publicRouteResultSchema),
  warnings: z.array(z.string()),
  provider_failures: z.array(providerFailureSchema),
})
export type QuoteResponse = z.infer<typeof quoteResponseSchema>
