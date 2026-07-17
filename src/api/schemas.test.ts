import { describe, expect, it } from 'vitest'
import { makeQuoteResponse, corridorsFixture } from '../test/fixtures'
import {
  corridorsResponseSchema,
  publicRouteResultSchema,
  quoteResponseSchema,
} from './schemas'

describe('corridors schema', () => {
  it('parses a valid corridors response', () => {
    expect(corridorsResponseSchema.safeParse(corridorsFixture).success).toBe(true)
  })

  it('rejects a corridor missing a required field', () => {
    const [corridor] = structuredClone(corridorsFixture)
    // @ts-expect-error intentional deletion
    delete corridor.source_currency
    expect(corridorsResponseSchema.safeParse([corridor]).success).toBe(false)
  })
})

describe('quote response schema', () => {
  it('parses a contract-complete response and keeps Decimal strings verbatim', () => {
    const parsed = quoteResponseSchema.parse(makeQuoteResponse())
    expect(parsed.sent_amount).toBe('250')
    expect(typeof parsed.sent_amount).toBe('string')
    expect(parsed.recommended_route.estimated_received_amount).toBe('4821.07')
    expect(typeof parsed.recommended_route.total_cost).toBe('string')
    expect(parsed.recommended_route.effective_fx_rate).toBe('19.284280')
  })

  const REQUIRED_RESPONSE_KEYS = [
    'disclaimer',
    'simulation_only',
    'generated_at',
    'quote_expires_at',
    'sent_amount',
    'source_currency',
    'destination_currency',
    'objective',
    'recommended_route',
    'alternative_routes',
    'warnings',
    'provider_failures',
  ] as const

  it.each(REQUIRED_RESPONSE_KEYS)(
    'rejects a response missing required field %s',
    (key) => {
      const body: Record<string, unknown> = structuredClone(
        makeQuoteResponse(),
      ) as unknown as Record<string, unknown>
      delete body[key]
      expect(quoteResponseSchema.safeParse(body).success).toBe(false)
    },
  )

  const REQUIRED_ROUTE_KEYS = [
    'route_id',
    'simulation_only',
    'steps',
    'total_cost',
    'total_cost_percentage',
    'total_time_seconds',
    'expected_time_seconds',
    'conservative_time_seconds',
    'time_to_fiat_available_seconds',
    'latency_breakdown',
    'latency_legs',
    'operates_24_7',
    'effective_fx_rate',
    'estimated_received_amount',
    'reliability_score',
    'objective_score',
    'expires_at',
    'explanation',
    'warnings',
  ] as const

  it.each(REQUIRED_ROUTE_KEYS)(
    'rejects a route missing required field %s',
    (key) => {
      const route: Record<string, unknown> = structuredClone(
        makeQuoteResponse().recommended_route,
      ) as unknown as Record<string, unknown>
      delete route[key]
      expect(publicRouteResultSchema.safeParse(route).success).toBe(false)
    },
  )

  it('rejects simulation_only different from true on the response', () => {
    const body = structuredClone(makeQuoteResponse()) as unknown as Record<
      string,
      unknown
    >
    body.simulation_only = false
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects simulation_only different from true on a route', () => {
    const body = structuredClone(makeQuoteResponse())
    ;(body.recommended_route as unknown as Record<string, unknown>).simulation_only =
      false
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a Decimal field that is not a decimal string', () => {
    const body = structuredClone(makeQuoteResponse()) as unknown as Record<
      string,
      unknown
    >
    body.sent_amount = 250
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })
})
