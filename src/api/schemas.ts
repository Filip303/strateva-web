/**
 * Zod schemas for the public backend contract.
 *
 * Source of truth: the schema CODE of Filip303/strateva-payment-router at
 * commit a697ca08348d0f1ec19bcb715c7a54ce6dff625f —
 * `api/schemas.py`, `api/public.py`, `domain/models.py`, `domain/latency.py`
 * and `providers/failures.py`. The repository's `examples/quote-response.json`
 * is outdated and is NOT a source of truth.
 *
 * Decimal amounts arrive as JSON strings and are kept as strings end to end —
 * the UI never parses them into floats, never recalculates them and never
 * invents figures the API did not return.
 *
 * A response missing a required field, or with `simulation_only` different
 * from `true`, fails validation and is never partially rendered.
 */

import { z } from 'zod'

/** Decimal serialized by the backend as a JSON string. Kept verbatim. */
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'expected a decimal string')

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

// --- GET /api/v1/corridors -------------------------------------------------

export const corridorInfoSchema = z.object({
  corridor_id: z.string(),
  origin_country: z.string(),
  destination_country: z.string(),
  source_currency: z.string(),
  destination_currency: z.string(),
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
  asset: z.string(),
  network: z.string().nullable(),
  country: z.string().nullable(),
  account_type: z.string(),
  provider: z.string().nullable(),
  metadata: z.record(z.string(), z.string()),
})

const routeStepSchema = z.object({
  position: z.number().int().min(0),
  source_node: paymentNodeSchema,
  destination_node: paymentNodeSchema,
  provider: z.string(),
  operation_type: z.string(),
  fixed_fee: decimalString,
  percentage_fee_amount: decimalString,
  spread_cost: decimalString,
  estimated_time_seconds: z.number().int(),
  reliability_score: z.number(),
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

const latencyBreakdownEntrySchema = z.object({
  component: latencyComponentSchema,
  expected_seconds: z.number().int().min(0),
  conservative_seconds: z.number().int().min(0),
})

const publicLatencyLegSchema = z.object({
  position: z.number().int().min(0),
  edge_id: z.string(),
  provider: z.string(),
  component: latencyComponentSchema,
  confirmation_target: z.enum(['included', 'safe', 'finalized']).nullable(),
  expected_seconds: z.number().int().min(0),
  conservative_seconds: z.number().int().min(0),
  availability: z.enum(['continuous', 'banking_hours']),
  basis: z.enum(['operational_duration', 'calendar_elapsed']),
  latency_source: z.enum(['observed', 'declarative']),
  provenance: z.enum(['observed', 'declarative', 'fallback']),
  fallback_reason: z.string().nullable(),
  as_of: z.string().nullable(),
  valid_until: z.string().nullable(),
})

export const publicRouteResultSchema = z.object({
  route_id: z.string(),
  simulation_only: z.literal(true),
  steps: z.array(routeStepSchema),
  total_cost: decimalString,
  total_cost_percentage: decimalString,
  total_time_seconds: z.number().int(),
  expected_time_seconds: z.number().int(),
  conservative_time_seconds: z.number().int(),
  time_to_fiat_available_seconds: z.number().int(),
  latency_breakdown: z.array(latencyBreakdownEntrySchema),
  latency_legs: z.array(publicLatencyLegSchema),
  operates_24_7: z.boolean(),
  effective_fx_rate: decimalString,
  estimated_received_amount: decimalString,
  reliability_score: z.number(),
  objective_score: z.number(),
  expires_at: z.string(),
  explanation: z.string(),
  warnings: z.array(z.string()),
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
  occurred_at: z.string(),
  safe_message: z.string(),
})

export const quoteResponseSchema = z.object({
  disclaimer: z.string(),
  simulation_only: z.literal(true),
  generated_at: z.string(),
  quote_expires_at: z.string(),
  sent_amount: decimalString,
  source_currency: z.string(),
  destination_currency: z.string(),
  objective: objectiveSchema,
  recommended_route: publicRouteResultSchema,
  alternative_routes: z.array(publicRouteResultSchema),
  warnings: z.array(z.string()),
  provider_failures: z.array(providerFailureSchema),
})
export type QuoteResponse = z.infer<typeof quoteResponseSchema>
