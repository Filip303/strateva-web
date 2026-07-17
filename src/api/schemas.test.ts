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

type Mutable = Record<string, unknown>

function quoteBody(): Mutable {
  return structuredClone(makeQuoteResponse()) as unknown as Mutable
}

function firstLeg(body: Mutable): Mutable {
  const route = body.recommended_route as Mutable
  return (route.latency_legs as Mutable[])[0]
}

function firstStep(body: Mutable): Mutable {
  const route = body.recommended_route as Mutable
  return (route.steps as Mutable[])[0]
}

const VALID_FAILURE = {
  provider_id: 'mock_provider',
  operation_id: null,
  category: 'temporary',
  retryable: true,
  occurred_at: '2026-07-17T10:00:00Z',
  safe_message: 'temporary provider failure',
}

describe('contract guarantees', () => {
  it('accepts a valid provider failure and a valid observed leg (controls)', () => {
    const body = quoteBody()
    body.provider_failures = [VALID_FAILURE]
    const leg = firstLeg(body)
    leg.latency_source = 'observed'
    leg.provenance = 'observed'
    leg.as_of = '2026-07-01'
    leg.valid_until = '2026-08-01'
    expect(quoteResponseSchema.safeParse(body).success).toBe(true)
  })

  it('rejects a corridor country with the wrong length', () => {
    const corridor = { ...corridorsFixture[0], origin_country: 'AAA' }
    expect(corridorsResponseSchema.safeParse([corridor]).success).toBe(false)
  })

  it('rejects an empty currency', () => {
    const corridor = { ...corridorsFixture[0], source_currency: '' }
    expect(corridorsResponseSchema.safeParse([corridor]).success).toBe(false)
  })

  it('rejects an unknown account_type', () => {
    const body = quoteBody()
    ;(firstStep(body).source_node as Mutable).account_type = 'wallet'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects an unknown operation_type', () => {
    const body = quoteBody()
    firstStep(body).operation_type = 'teleport'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it.each(['generated_at', 'quote_expires_at'])(
    'rejects an invalid %s timestamp',
    (key) => {
      const body = quoteBody()
      body[key] = 'not-a-timestamp'
      expect(quoteResponseSchema.safeParse(body).success).toBe(false)
    },
  )

  it('rejects an invalid route expires_at', () => {
    const body = quoteBody()
    ;(body.recommended_route as Mutable).expires_at = '17-07-2026'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects an invalid provider failure occurred_at', () => {
    const body = quoteBody()
    body.provider_failures = [{ ...VALID_FAILURE, occurred_at: 'yesterday' }]
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects an invalid as_of date on an observed leg', () => {
    const body = quoteBody()
    const leg = firstLeg(body)
    leg.latency_source = 'observed'
    leg.provenance = 'observed'
    leg.as_of = '2026-7-1'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a reliability score outside 0-1', () => {
    const body = quoteBody()
    ;(body.recommended_route as Mutable).reliability_score = 1.5
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a negative time', () => {
    const body = quoteBody()
    ;(body.recommended_route as Mutable).expected_time_seconds = -1
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a route whose conservative time is below its expected time', () => {
    const body = quoteBody()
    ;(body.recommended_route as Mutable).conservative_time_seconds = 100
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a leg whose conservative time is below its expected time', () => {
    const body = quoteBody()
    firstLeg(body).conservative_seconds = 10
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a confirmation_target on a non-chain leg', () => {
    const body = quoteBody()
    firstLeg(body).confirmation_target = 'safe'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a chain_confirmation leg without a confirmation_target', () => {
    const body = quoteBody()
    const leg = firstLeg(body)
    leg.component = 'chain_confirmation'
    leg.confirmation_target = null
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('accepts a chain_confirmation leg with a confirmation_target', () => {
    const body = quoteBody()
    const leg = firstLeg(body)
    leg.component = 'chain_confirmation'
    leg.confirmation_target = 'safe'
    expect(quoteResponseSchema.safeParse(body).success).toBe(true)
  })

  it('rejects observed latency_source with declarative provenance', () => {
    const body = quoteBody()
    const leg = firstLeg(body)
    leg.latency_source = 'observed'
    leg.provenance = 'declarative'
    leg.as_of = '2026-07-01'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects a fallback provenance without a fallback_reason', () => {
    const body = quoteBody()
    const leg = firstLeg(body)
    leg.provenance = 'fallback'
    leg.fallback_reason = null
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('rejects evidence dates on a declarative leg', () => {
    const body = quoteBody()
    firstLeg(body).as_of = '2026-07-01'
    expect(quoteResponseSchema.safeParse(body).success).toBe(false)
  })

  it('tolerates unknown extra fields (forward compatibility)', () => {
    const body = quoteBody()
    body.future_additive_field = 'ignored'
    expect(quoteResponseSchema.safeParse(body).success).toBe(true)
  })
})
