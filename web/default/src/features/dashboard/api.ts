import { api } from '@/lib/api'
import { computeTimeRange } from '@/lib/time'
import { getDefaultDays } from './lib/filters'
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

// Get user quota data within a time range
// Admin users get all users' data by default (matching classic frontend behavior)
export async function getUserQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data' : '/api/data/self'
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    endpoint,
    { params }
  )
  return res.data
}

// ----------------------------------------------------------------------------
// System Monitoring
// ----------------------------------------------------------------------------

export async function getUserQuotaDataByUsers(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/users',
    { params }
  )
  return res.data
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
): Promise<{ success: boolean; data?: LogUsageAnalysisResponse }> {
  const params = buildLogUsageAnalysisParams(
    filters,
    isAdmin,
    dimensionsOverride
  )
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
