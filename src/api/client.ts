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

/** Hard cap on any JSON response body: 1 MiB. Enforced BEFORE buffering —
 * via Content-Length when declared, and incrementally while streaming
 * chunked or length-less bodies — so an oversized response is cancelled,
 * never stored whole. Exceeding it maps to the sanitized contract error
 * (no sizes or bodies are ever surfaced). */
export const MAX_RESPONSE_BYTES = 1_048_576

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

function isAbort(error: unknown, controller: AbortController): boolean {
  return (
    controller.signal.aborted ||
    (error instanceof DOMException && error.name === 'AbortError')
  )
}

/** Read a JSON body with a hard 1 MiB cap, incrementally.
 *
 * `response.text()` would buffer an unbounded body first, so the stream is
 * read chunk by chunk instead: the read is cancelled the moment the running
 * total exceeds MAX_RESPONSE_BYTES. Each chunk read races against the
 * request's abort signal so the 15 s timeout keeps covering a stalled body
 * even when the underlying stream is not tied to the signal. */
async function readBoundedJson(
  response: Response,
  controller: AbortController,
): Promise<unknown> {
  const declaredLength = response.headers.get('Content-Length')
  if (declaredLength !== null) {
    const declared = Number.parseInt(declaredLength, 10)
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => {})
      throw new ApiError('contract')
    }
  }

  let text: string
  if (!response.body) {
    // No readable stream (e.g. an empty body): nothing to read incrementally.
    text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new ApiError('contract')
    }
  } else {
    const abortRejection = new Promise<never>((_resolve, reject) => {
      const rejectAbort = () =>
        reject(new DOMException('aborted', 'AbortError'))
      if (controller.signal.aborted) rejectAbort()
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
    })
    // Mark handled so a late abort never surfaces as an unhandled rejection.
    abortRejection.catch(() => {})

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>
      try {
        result = await Promise.race([reader.read(), abortRejection])
      } catch (error) {
        await reader.cancel().catch(() => {})
        if (isAbort(error, controller)) {
          throw new ApiError('timeout')
        }
        throw new ApiError('network')
      }
      if (result.done) break
      received += result.value.byteLength
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {})
        throw new ApiError('contract')
      }
      chunks.push(result.value)
    }
    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    text = new TextDecoder().decode(merged)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ApiError('contract')
  }
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

  // The abort timer stays armed for the WHOLE request lifecycle: headers,
  // full body read and JSON parsing. fetch() can resolve as soon as headers
  // arrive while the body stalls forever — clearing the timer there would
  // leave no timeout at all.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: init?.method ?? 'GET',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          ...(init?.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      if (isAbort(error, controller)) {
        throw new ApiError('timeout')
      }
      throw new ApiError('network')
    }

    if (!response.ok) {
      // The response body of an HTTP error is deliberately never read.
      throw errorForStatus(response.status, response.headers.get('Retry-After'))
    }

    // Bounded, incremental body read: an abort mid-body is a timeout, an
    // oversized or non-JSON body is a sanitized contract error.
    const payload: unknown = await readBoundedJson(response, controller)

    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new ApiError('contract')
    }
    return parsed.data
  } finally {
    clearTimeout(timer)
  }
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
