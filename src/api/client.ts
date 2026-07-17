/**
 * Typed HTTP client for the public backend contract.
 *
 * - `credentials: "omit"` — the public API is anonymous.
 * - Explicit timeout: every request is aborted after REQUEST_TIMEOUT_MS
 *   (15 s) via an AbortController and reported as a sanitized timeout error.
 * - No automatic retries at any layer; retrying is always a manual user
 *   action (and blocked for the duration of `Retry-After` after a 429).
 * - Responses are validated with Zod before anything reaches the UI; an
 *   invalid contract fails safe and renders nothing partial.
 * - Errors are sanitized: technical bodies, stack traces and configuration
 *   never surface.
 */

import type { z } from 'zod'
import { getApiBaseUrl } from './config'
import { ApiError } from './errors'
import {
  corridorsResponseSchema,
  quoteResponseSchema,
  type CorridorInfo,
  type QuoteRequestBody,
  type QuoteResponse,
} from './schemas'

/** Documented request timeout: 15 seconds end to end per request. */
export const REQUEST_TIMEOUT_MS = 15_000

const DEFAULT_RETRY_AFTER_SECONDS = 30
const MAX_RETRY_AFTER_SECONDS = 600

/** Parse a Retry-After header (seconds or HTTP-date) into bounded seconds. */
export function parseRetryAfter(value: string | null): number {
  if (value !== null) {
    if (/^\d+$/.test(value.trim())) {
      const seconds = Number.parseInt(value.trim(), 10)
      return Math.min(Math.max(seconds, 1), MAX_RETRY_AFTER_SECONDS)
    }
    const dateMs = Date.parse(value)
    if (!Number.isNaN(dateMs)) {
      const seconds = Math.ceil((dateMs - Date.now()) / 1000)
      return Math.min(Math.max(seconds, 1), MAX_RETRY_AFTER_SECONDS)
    }
  }
  return DEFAULT_RETRY_AFTER_SECONDS
}

function errorForStatus(status: number, retryAfter: string | null): ApiError {
  if (status === 404) return new ApiError('not_found')
  if (status === 422) return new ApiError('invalid_request')
  if (status === 429) return new ApiError('rate_limited', parseRetryAfter(retryAfter))
  // 5xx and anything else unexpected: sanitized generic unavailability.
  return new ApiError('server')
}

async function request<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<z.infer<Schema>> {
  const baseUrl = getApiBaseUrl()
  if (baseUrl === null) {
    throw new ApiError('config')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('timeout')
    }
    throw new ApiError('network')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // The response body is deliberately never read into an error message.
    throw errorForStatus(response.status, response.headers.get('Retry-After'))
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('contract')
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError('contract')
  }
  return parsed.data
}

/** GET /api/v1/corridors — the only source of available corridors. */
export function fetchCorridors(): Promise<CorridorInfo[]> {
  return request('/api/v1/corridors', corridorsResponseSchema)
}

/** POST /api/v1/routes/quote — never retried automatically. */
export function requestQuote(body: QuoteRequestBody): Promise<QuoteResponse> {
  return request('/api/v1/routes/quote', quoteResponseSchema, {
    method: 'POST',
    body,
  })
}
