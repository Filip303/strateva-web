import { afterEach, describe, expect, it, vi } from 'vitest'
import { corridorsFixture, makeQuoteResponse } from '../test/fixtures'
import {
  fetchCorridors,
  MAX_RESPONSE_BYTES,
  parseRetryAfter,
  REQUEST_TIMEOUT_MS,
  requestQuote,
} from './client'
import { ApiError } from './errors'

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
}

const QUOTE_BODY = {
  origin_country: 'AA',
  destination_country: 'BB',
  source_currency: 'AAA',
  destination_currency: 'BBB',
  amount: '250',
  objective: 'balanced',
} as const

async function expectApiError(promise: Promise<unknown>, kind: string) {
  let caught: unknown
  try {
    await promise
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(ApiError)
  expect((caught as ApiError).kind).toBe(kind)
  return caught as ApiError
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
})

describe('request mechanics', () => {
  it('GET sends Accept header, omits credentials and hits the configured URL', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(corridorsFixture))
    vi.stubGlobal('fetch', fetchMock)
    await fetchCorridors()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:8000/api/v1/corridors')
    expect(init.credentials).toBe('omit')
    expect((init.headers as Record<string, string>).Accept).toBe(
      'application/json',
    )
    expect(init.method).toBe('GET')
  })

  it('POST sends a JSON content type and the exact body', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(makeQuoteResponse()))
    vi.stubGlobal('fetch', fetchMock)
    await requestQuote(QUOTE_BODY)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:8000/api/v1/routes/quote')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
    expect(JSON.parse(init.body as string)).toEqual(QUOTE_BODY)
  })

  it('never retries automatically: one HTTP call per request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(requestQuote(QUOTE_BODY), 'server')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails safe with a config error (and no request) when VITE_API_URL is missing', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(fetchCorridors(), 'config')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails safe with a config error for a non-HTTP URL', async () => {
    vi.stubEnv('VITE_API_URL', 'ftp://example.invalid')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(fetchCorridors(), 'config')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('error mapping', () => {
  it('maps 404 to not_found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 404 })))
    await expectApiError(requestQuote(QUOTE_BODY), 'not_found')
  })

  it('maps 422 to invalid_request without leaking the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ detail: 'INTERNAL TECHNICAL DETAIL' }, { status: 422 }),
      ),
    )
    const error = await expectApiError(requestQuote(QUOTE_BODY), 'invalid_request')
    expect(error.message).not.toMatch(/INTERNAL TECHNICAL DETAIL/)
  })

  it('maps 429 to rate_limited and reads Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({}, { status: 429, headers: { 'Retry-After': '7' } }),
      ),
    )
    const error = await expectApiError(requestQuote(QUOTE_BODY), 'rate_limited')
    expect(error.retryAfterSeconds).toBe(7)
  })

  it('maps 5xx to a sanitized server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 503 })))
    await expectApiError(requestQuote(QUOTE_BODY), 'server')
  })

  it('maps a network failure to a sanitized network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('failed to fetch')
      }),
    )
    await expectApiError(requestQuote(QUOTE_BODY), 'network')
  })

  it('aborts after the documented timeout and maps it to timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )
    const pending = requestQuote(QUOTE_BODY)
    const assertion = expectApiError(pending, 'timeout')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
  })

  it('maps a non-JSON 200 response to a contract error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { status: 200 })),
    )
    await expectApiError(fetchCorridors(), 'contract')
  })

  it('maps a schema-invalid 200 response to a contract error', async () => {
    const body = structuredClone(makeQuoteResponse()) as unknown as Record<
      string,
      unknown
    >
    delete body.recommended_route
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(body)))
    await expectApiError(requestQuote(QUOTE_BODY), 'contract')
  })
})

describe('parseRetryAfter', () => {
  it('parses integer seconds', () => {
    expect(parseRetryAfter('7')).toBe(7)
  })
  it('clamps huge values', () => {
    expect(parseRetryAfter('99999')).toBe(600)
  })
  it('falls back to a bounded default for missing or invalid values', () => {
    expect(parseRetryAfter(null)).toBe(30)
    expect(parseRetryAfter('not-a-value')).toBe(30)
  })
})

describe('timeout covers the whole body', () => {
  it('times out when fetch resolves 200 but the body stalls until abort', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const stalled = new ReadableStream<Uint8Array>({
          start() {
            // Never enqueue, never close: headers arrived but the body stalls.
          },
        })
        return new Response(stalled, { status: 200 })
      }),
    )
    const pending = requestQuote(QUOTE_BODY)
    const assertion = expectApiError(pending, 'timeout')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
  })

  it('a genuine JSON failure without an abort stays a contract error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not-json{', { status: 200 })),
    )
    await expectApiError(fetchCorridors(), 'contract')
  })
})

describe('bounded response size (MAX_RESPONSE_BYTES)', () => {
  const encoder = new TextEncoder()

  function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })
  }

  it('rejects a declared Content-Length above the limit without reading the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('{}', {
          status: 200,
          headers: { 'Content-Length': String(MAX_RESPONSE_BYTES + 1) },
        }),
      ),
    )
    const error = await expectApiError(fetchCorridors(), 'contract')
    // Sanitized: the public message never mentions sizes or bodies.
    expect(error.message).not.toMatch(/\d/)
  })

  it('cancels a chunked body the moment it exceeds the limit', async () => {
    const chunk = encoder.encode('x'.repeat(600 * 1024))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOf([chunk, chunk]), { status: 200 })),
    )
    await expectApiError(fetchCorridors(), 'contract')
  })

  it('accepts a valid body exactly at the limit', async () => {
    const json = JSON.stringify(corridorsFixture)
    // Trailing whitespace is valid JSON padding: exactly MAX_RESPONSE_BYTES.
    const padded = json + ' '.repeat(MAX_RESPONSE_BYTES - json.length)
    expect(encoder.encode(padded).byteLength).toBe(MAX_RESPONSE_BYTES)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(streamOf([encoder.encode(padded)]), { status: 200 }),
      ),
    )
    const corridors = await fetchCorridors()
    expect(corridors).toEqual(corridorsFixture)
  })

  it('still accepts a normal valid response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(corridorsFixture)))
    await expect(fetchCorridors()).resolves.toEqual(corridorsFixture)
  })

  it('never retries automatically after an oversized response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('{}', {
        status: 200,
        headers: { 'Content-Length': String(MAX_RESPONSE_BYTES * 2) },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(requestQuote(QUOTE_BODY), 'contract')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('VITE_API_URL hardening', () => {
  it('accepts a plain origin and a trailing slash, producing the same endpoint', async () => {
    for (const url of ['http://localhost:8000', 'http://localhost:8000/']) {
      vi.stubEnv('VITE_API_URL', url)
      const fetchMock = vi.fn(async () => jsonResponse(corridorsFixture))
      vi.stubGlobal('fetch', fetchMock)
      await fetchCorridors()
      const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string]
      expect(String(calledUrl)).toBe('http://localhost:8000/api/v1/corridors')
    }
  })

  it.each([
    ['credentials', 'http://user:secret@localhost:8000'],
    ['a query string', 'http://localhost:8000/?x=1'],
    ['a fragment', 'http://localhost:8000/#frag'],
    ['a base path', 'http://localhost:8000/api'],
    ['a non-HTTP protocol', 'ws://localhost:8000'],
  ])('rejects a URL with %s and never calls fetch', async (_label, url) => {
    vi.stubEnv('VITE_API_URL', url)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(fetchCorridors(), 'config')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('cancellation never blocks the error', () => {
  const encoder = new TextEncoder()

  function oversizedStreamWithHangingCancel(): ReadableStream<Uint8Array> {
    const chunk = encoder.encode('x'.repeat(600 * 1024))
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.enqueue(chunk)
        // never close
      },
      cancel() {
        // A cancel() that NEVER settles must not delay the public error.
        return new Promise<never>(() => {})
      },
    })
  }

  it('returns contract immediately for an oversized body even if cancel() never resolves', async () => {
    const fetchMock = vi.fn(
      async () => new Response(oversizedStreamWithHangingCancel(), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(fetchCorridors(), 'contract')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns timeout at REQUEST_TIMEOUT_MS for a stalled body even if cancel() never resolves', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => {
      const stalled = new ReadableStream<Uint8Array>({
        start() {
          // never enqueue, never close
        },
        cancel() {
          return new Promise<never>(() => {})
        },
      })
      return new Response(stalled, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const pending = requestQuote(QUOTE_BODY)
    const assertion = expectApiError(pending, 'timeout')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns contract immediately when Content-Length exceeds the limit and cancel() hangs', async () => {
    const fetchMock = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start() {},
        cancel() {
          return new Promise<never>(() => {})
        },
      })
      const response = new Response(body, { status: 200 })
      // Response normalizes headers; force the oversized declaration.
      Object.defineProperty(response, 'headers', {
        value: new Headers({ 'Content-Length': String(MAX_RESPONSE_BYTES + 1) }),
      })
      return response
    })
    vi.stubGlobal('fetch', fetchMock)
    await expectApiError(fetchCorridors(), 'contract')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
