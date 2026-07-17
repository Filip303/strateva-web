import { useEffect, useState } from 'react'
import { ApiError } from '../api/errors'

/**
 * Manual-retry countdown for rate-limited errors.
 *
 * When `error` is an ApiError with kind 'rate_limited', starts a countdown
 * from its (bounded) Retry-After seconds; the caller keeps its retry control
 * disabled until the countdown reaches zero. No automatic refetch ever
 * happens — retrying stays a manual user action. A single chained timeout is
 * used (no duplicated timers) and it is cleaned up on unmount.
 */
export function useRetryCountdown(error: unknown): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (error instanceof ApiError && error.kind === 'rate_limited') {
      setSeconds(error.retryAfterSeconds ?? 30)
    }
  }, [error])

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  return seconds
}
