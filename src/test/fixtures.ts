/**
 * Contract fixtures for tests.
 *
 * Built from the authoritative backend schema CODE at commit
 * a697ca08348d0f1ec19bcb715c7a54ce6dff625f (api/schemas.py, api/public.py,
 * domain/models.py, domain/latency.py, providers/failures.py) — NOT copied
 * from the repository's outdated examples/quote-response.json.
 *
 * Corridor codes are deliberately synthetic (AAA→BBB) so any hardcoded
 * real-corridor assumption in the UI would fail these tests.
 */

import type { CorridorInfo, QuoteResponse } from '../api/schemas'

export const corridorsFixture: CorridorInfo[] = [
  {
    corridor_id: 'aaa_bbb',
    origin_country: 'AA',
    destination_country: 'BB',
    source_currency: 'AAA',
    destination_currency: 'BBB',
  },
]

export const CORRIDOR_OPTION_LABEL = 'AAA (AA) → BBB (BB)'

function route(overrides: {
  route_id: string
  expires_at: string
  estimated_received_amount: string
  total_cost: string
}): QuoteResponse['recommended_route'] {
  return {
    route_id: overrides.route_id,
    simulation_only: true,
    steps: [
      {
        position: 0,
        source_node: {
          node_id: 'aaa_bank_aa',
          asset: 'AAA',
          network: 'rail_x',
          country: 'AA',
          account_type: 'bank_account',
          provider: null,
          metadata: {},
        },
        destination_node: {
          node_id: 'bbb_bank_bb',
          asset: 'BBB',
          network: 'rail_y',
          country: 'BB',
          account_type: 'bank_account',
          provider: 'mock_provider',
          metadata: {},
        },
        provider: 'mock_provider',
        operation_type: 'fx_conversion',
        fixed_fee: '1.25',
        percentage_fee_amount: '0.50',
        spread_cost: '3.75',
        estimated_time_seconds: 600,
        reliability_score: 0.98,
        amount_in: '250.00',
        amount_out: overrides.estimated_received_amount,
      },
    ],
    total_cost: overrides.total_cost,
    total_cost_percentage: '0.2590',
    total_time_seconds: 600,
    expected_time_seconds: 600,
    conservative_time_seconds: 900,
    time_to_fiat_available_seconds: 900,
    latency_breakdown: [
      { component: 'bank_settlement', expected_seconds: 600, conservative_seconds: 900 },
    ],
    latency_legs: [
      {
        position: 0,
        edge_id: 'edge_fx',
        provider: 'mock_provider',
        component: 'bank_settlement',
        confirmation_target: null,
        expected_seconds: 600,
        conservative_seconds: 900,
        availability: 'banking_hours',
        basis: 'operational_duration',
        latency_source: 'declarative',
        provenance: 'declarative',
        fallback_reason: null,
        as_of: null,
        valid_until: null,
      },
    ],
    operates_24_7: false,
    effective_fx_rate: '19.284280',
    estimated_received_amount: overrides.estimated_received_amount,
    reliability_score: 0.98,
    objective_score: 0.15,
    expires_at: overrides.expires_at,
    explanation: 'Best combined score among the simulated candidates.',
    warnings: ['All figures are simulated.'],
  }
}

export function makeQuoteResponse(): QuoteResponse {
  return {
    disclaimer:
      'Simulation only. Strateva does not execute, custody or transmit customer funds.',
    simulation_only: true,
    generated_at: '2026-07-17T11:58:30Z',
    quote_expires_at: '2026-07-17T11:59:30Z',
    sent_amount: '250',
    source_currency: 'AAA',
    destination_currency: 'BBB',
    objective: 'balanced',
    recommended_route: route({
      route_id: 'rt_recommended',
      expires_at: '2026-07-17T12:00:00Z',
      estimated_received_amount: '4821.07',
      total_cost: '12.50',
    }),
    alternative_routes: [
      route({
        route_id: 'rt_alternative',
        expires_at: '2026-07-17T11:58:00Z',
        estimated_received_amount: '4790.33',
        total_cost: '43.24',
      }),
    ],
    warnings: [],
    provider_failures: [],
  }
}

/**
 * A contract-complete response whose recommended route carries a richer
 * latency picture: three distinct route times, plus declarative, observed,
 * fallback and chain-confirmation legs — for the results-UX regressions.
 * Built from the same authoritative schemas; still fully schema-valid.
 */
export function makeDetailedQuoteResponse(): QuoteResponse {
  const base = makeQuoteResponse()
  const recommended = base.recommended_route
  return {
    ...base,
    recommended_route: {
      ...recommended,
      // Three DISTINCT time magnitudes.
      expected_time_seconds: 600,
      conservative_time_seconds: 900,
      time_to_fiat_available_seconds: 1200,
      latency_breakdown: [
        ...recommended.latency_breakdown,
        { component: 'onramp', expected_seconds: 120, conservative_seconds: 180 },
        {
          component: 'chain_confirmation',
          expected_seconds: 120,
          conservative_seconds: 240,
        },
        { component: 'offramp', expected_seconds: 300, conservative_seconds: 600 },
      ],
      latency_legs: [
        ...recommended.latency_legs,
        {
          position: 1,
          edge_id: 'edge_onramp',
          provider: 'mock_ramp',
          component: 'onramp',
          confirmation_target: null,
          expected_seconds: 120,
          conservative_seconds: 180,
          availability: 'banking_hours',
          basis: 'operational_duration',
          latency_source: 'observed',
          provenance: 'observed',
          fallback_reason: null,
          as_of: '2026-07-01',
          valid_until: '2026-08-01',
        },
        {
          position: 2,
          edge_id: 'edge_chain',
          provider: 'mock_ramp',
          component: 'chain_confirmation',
          confirmation_target: 'safe',
          expected_seconds: 120,
          conservative_seconds: 240,
          availability: 'continuous',
          basis: 'operational_duration',
          latency_source: 'declarative',
          provenance: 'declarative',
          fallback_reason: null,
          as_of: null,
          valid_until: null,
        },
        {
          position: 3,
          edge_id: 'edge_offramp',
          provider: 'mock_payout',
          component: 'offramp',
          confirmation_target: null,
          expected_seconds: 300,
          conservative_seconds: 600,
          availability: 'banking_hours',
          basis: 'operational_duration',
          latency_source: 'declarative',
          provenance: 'fallback',
          fallback_reason: 'evidence_stale',
          as_of: null,
          valid_until: null,
        },
      ],
    },
  }
}
