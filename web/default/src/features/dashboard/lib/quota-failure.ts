import { QuotaSeriesError } from '@/features/dashboard/api'
import { DashboardRangeError } from './range'

/**
 * True when a rejection is the caller's own cancellation rather than a failure.
 * Cancelled requests must be silent: they belong to a range the user has
 * already moved away from.
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: string; code?: string }
  return (
    candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError' ||
    candidate.code === 'ERR_CANCELED'
  )
}

/**
 * Produces a user-facing message for a failed quota series load.
 *
 * Every branch returns a non-empty string: a failure is always shown as an
 * error state, never silently degraded to a zeroed statistic.
 */
export function describeQuotaFailure(
  error: unknown,
  fallback = 'Failed to load dashboard data'
): string {
  if (error instanceof DashboardRangeError) return error.message
  if (error instanceof QuotaSeriesError) return error.message

  if (error && typeof error === 'object') {
    const response = (
      error as {
        response?: { data?: { message?: string; error?: string } }
      }
    ).response
    const payload = response?.data
    if (payload?.message) return payload.message
    if (payload?.error) return payload.error
    const message = (error as { message?: string }).message
    if (message) return message
  }
  return fallback
}

/** The stable server code for a failure, when the server supplied one. */
export function quotaFailureCode(error: unknown): string | undefined {
  if (error instanceof DashboardRangeError) return error.code
  if (error instanceof QuotaSeriesError) return error.code
  if (error && typeof error === 'object') {
    return (error as { response?: { data?: { code?: string } } }).response?.data
      ?.code
  }
  return undefined
}
