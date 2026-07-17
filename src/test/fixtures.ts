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
 * A contract-complete, ENGINE-COHERENT detailed response: the recommended
 * route has one latency leg per step (same order, matching positions), the
 * per-component breakdown and both leg/breakdown sums equal the route
 * totals, and total_time_seconds equals expected_time_seconds — exactly the
 * invariants the backend derives from its per-leg latency profiles. It keeps
 * declarative, observed, fallback and chain-confirmation legs for the
 * results-UX regressions (fallback reason: the backend-style code 'stale').
 */
export function makeDetailedQuoteResponse(): QuoteResponse {
  const base = makeQuoteResponse()
  const recommended = base.recommended_route
  const fxStep = recommended.steps[0]
  const tokenNode = {
    node_id: 'ttt_chainx',
    asset: 'TTT',
    network: 'chainx',
    country: null,
    account_type: 'onchain',
    provider: 'mock_ramp',
    metadata: {},
  } as const
  return {
    ...base,
    recommended_route: {
      ...recommended,
      steps: [
        fxStep,
        {
          position: 1,
          source_node: fxStep.destination_node,
          destination_node: tokenNode,
          provider: 'mock_ramp',
          operation_type: 'onramp',
          fixed_fee: '0',
          percentage_fee_amount: '0',
          spread_cost: '0',
          estimated_time_seconds: 120,
          reliability_score: 0.97,
          amount_in: '4821.07',
          amount_out: '4821.07',
        },
        {
          position: 2,
          source_node: tokenNode,
          destination_node: { ...tokenNode, node_id: 'ttt_chainx_offramp' },
          provider: 'mock_ramp',
          operation_type: 'onchain_transfer',
          fixed_fee: '0',
          percentage_fee_amount: '0',
          spread_cost: '0',
          estimated_time_seconds: 120,
          reliability_score: 0.99,
          amount_in: '4821.07',
          amount_out: '4821.07',
        },
        {
          position: 3,
          source_node: { ...tokenNode, node_id: 'ttt_chainx_offramp' },
          destination_node: fxStep.destination_node,
          provider: 'mock_payout',
          operation_type: 'offramp',
          fixed_fee: '0',
          percentage_fee_amount: '0',
          spread_cost: '0',
          estimated_time_seconds: 300,
          reliability_score: 0.96,
          amount_in: '4821.07',
          amount_out: '4821.07',
        },
      ],
      // Coherent totals: expected 600+120+120+300 = 1140; conservative
      // 900+180+240+600 = 1920; total_time == expected_time.
      total_time_seconds: 1140,
      expected_time_seconds: 1140,
      conservative_time_seconds: 1920,
      time_to_fiat_available_seconds: 1920,
      latency_breakdown: [
        { component: 'bank_settlement', expected_seconds: 600, conservative_seconds: 900 },
        { component: 'onramp', expected_seconds: 120, conservative_seconds: 180 },
        {
          component: 'chain_confirmation',
          expected_seconds: 120,
          conservative_seconds: 240,
        },
        { component: 'offramp', expected_seconds: 300, conservative_seconds: 600 },
      ],
      latency_legs: [
        recommended.latency_legs[0],
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
          fallback_reason: 'stale',
          as_of: null,
          valid_until: null,
        },
      ],
    },
  }
}
