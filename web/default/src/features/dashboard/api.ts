import { api } from '@/lib/api'
import { computeTimeRange } from '@/lib/time'
import type { AnalysisRequestResult } from './analysisState'
import { getDefaultDays } from './lib/filters'
import {
  assertDashboardRange,
  describeDashboardRangeError,
  validateDashboardRange,
} from './lib/range'
import type {
  DashboardFilters,
  LogUsageAnalysisResponse,
  QuotaDataItem,
  UptimeGroupResult,
} from './types'

export const ADMIN_ANALYSIS_DIMENSIONS = ['period', 'model_name'] as const
export const USER_ANALYSIS_DIMENSIONS = ['period', 'model_name'] as const
export const ANALYSIS_FALLBACK_DIMENSIONS = ['period'] as const

// ============================================================================
// Dashboard APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Quota & Usage Data
// ----------------------------------------------------------------------------

export interface QuotaSeriesResponse {
  success: boolean
  data: QuotaDataItem[]
  message?: string
  code?: string
}

// The quota series requests own their cancellation: the caller's AbortSignal is
// handed to the HTTP client so a superseded range is cancelled at the transport
// rather than merely ignored on arrival, and the global interceptor is bypassed
// so the panel can render its own error state.
function quotaRequestConfig(
  params: Record<string, unknown>,
  signal?: AbortSignal
) {
  return {
    params,
    signal,
    disableDuplicate: true,
    skipErrorHandler: true,
  } as unknown as Parameters<typeof api.get>[1]
}

// Get user quota data within a time range
// Admin users get all users' data by default (matching classic frontend behavior)
export async function getUserQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false,
  signal?: AbortSignal
): Promise<QuotaSeriesResponse> {
  assertDashboardRange(params.start_timestamp, params.end_timestamp)
  const endpoint = isAdmin ? '/api/data' : '/api/data/self'
  const res = await api.get<QuotaSeriesResponse>(
    endpoint,
    quotaRequestConfig(params, signal)
  )
  return res.data
}

// ----------------------------------------------------------------------------
// System Monitoring
// ----------------------------------------------------------------------------

export async function getUserQuotaDataByUsers(
  params: {
    start_timestamp: number
    end_timestamp: number
  },
  signal?: AbortSignal
): Promise<QuotaSeriesResponse> {
  assertDashboardRange(params.start_timestamp, params.end_timestamp)
  const res = await api.get<QuotaSeriesResponse>(
    '/api/data/users',
    quotaRequestConfig(params, signal)
  )
  return res.data
}

/**
 * Normalises a quota series response into rows, throwing on a business failure.
 *
 * A `success: false` payload is a refused query, not an empty range. Returning
 * `[]` for it would render as a legitimate "0 consumption" dashboard, hiding
 * the fact that the numbers on screen answer no question at all.
 */
export function unwrapQuotaSeries(response: QuotaSeriesResponse | undefined) {
  if (!response || !response.success) {
    throw new QuotaSeriesError(
      response?.message || 'Failed to load dashboard data',
      response?.code
    )
  }
  return response.data ?? []
}

export class QuotaSeriesError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'QuotaSeriesError'
    this.code = code
  }
}

// Get uptime monitoring status for all services
export async function getUptimeStatus() {
  const res = await api.get<{ success: boolean; data: UptimeGroupResult[] }>(
    '/api/uptime/status'
  )
  return res.data
}

export function buildLogUsageAnalysisParams(
  filters: DashboardFilters | undefined,
  isAdmin: boolean,
  dimensionsOverride?: readonly string[]
) {
  const range = computeTimeRange(
    getDefaultDays(filters?.time_granularity),
    filters?.start_timestamp,
    filters?.end_timestamp
  )
  const granularity = filters?.time_granularity === 'hour' ? 'hour' : 'day'
  const dimensions = (
    dimensionsOverride ||
    (isAdmin ? ADMIN_ANALYSIS_DIMENSIONS : USER_ANALYSIS_DIMENSIONS)
  ).join(',')
  const username = isAdmin ? filters?.username?.trim() : undefined
  return {
    ...range,
    granularity,
    dimensions,
    ...(username ? { username } : {}),
  }
}

export async function getLogUsageAnalysis(
  filters: DashboardFilters | undefined,
  isAdmin: boolean,
  dimensionsOverride?: readonly string[],
  signal?: AbortSignal
): Promise<AnalysisRequestResult> {
  const params = buildLogUsageAnalysisParams(
    filters,
    isAdmin,
    dimensionsOverride
  )
  // Enforce the shared bound client side. Returning the failure shape (rather
  // than throwing) keeps the caller's fallback/abort handling on one path.
  const rangeError = validateDashboardRange(
    params.start_timestamp,
    params.end_timestamp
  )
  if (rangeError) {
    return {
      success: false,
      code: rangeError,
      message: describeDashboardRangeError(rangeError),
    }
  }
  const endpoint = isAdmin ? '/api/log/analysis' : '/api/log/self/analysis'
  const analysisConfig = {
    params,
    signal,
    // Analysis owns cancellation and the fallback error presentation. Do not
    // let a stale GET promise or the global interceptor consume that state.
    disableDuplicate: true,
    skipErrorHandler: true,
  } as unknown as Parameters<typeof api.get>[1]
  const res = await api.get<{
    success: boolean
    data?: LogUsageAnalysisResponse
  }>(endpoint, analysisConfig)
  return res.data
}
