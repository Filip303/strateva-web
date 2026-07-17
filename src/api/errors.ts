/**
 * Sanitized API error taxonomy.
 *
 * Every error carries only a fixed, public English message. Technical
 * response bodies, stack traces, endpoints and configuration are never
 * surfaced to the UI.
 */

export type ApiErrorKind =
  | 'config'
  | 'not_found'
  | 'invalid_request'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'contract'

export const PUBLIC_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  config: 'The simulator is not configured. No request was sent.',
  not_found: 'That corridor is unavailable in the simulation.',
  invalid_request:
    'Invalid request, or no viable route exists within the simulation.',
  rate_limited: 'Too many simulations in a row. Please wait before retrying.',
  server: 'The simulation is temporarily unavailable. Try again in a moment.',
  timeout: 'The simulation took too long. This may be temporary.',
  network: 'The simulation service could not be reached.',
  contract: 'The simulation response could not be safely displayed.',
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** Seconds to wait before a manual retry (only set for `rate_limited`). */
  readonly retryAfterSeconds?: number

  constructor(kind: ApiErrorKind, retryAfterSeconds?: number) {
    super(PUBLIC_ERROR_MESSAGES[kind])
    this.name = 'ApiError'
    this.kind = kind
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Map any thrown value to a sanitized ApiError (never leaks details). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }
  return new ApiError('contract')
}
