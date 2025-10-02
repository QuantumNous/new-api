import { api } from '@/lib/api'
import type { UsageLog, LogStatistics } from './data/schema'
import { buildQueryParams } from './lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

export interface GetLogsParams {
  p?: number
  page_size?: number
  type?: number
  username?: string
  token_name?: string
  model_name?: string
  start_timestamp?: number
  end_timestamp?: number
  channel?: number
  group?: string
}

export interface GetLogsResponse {
  success: boolean
  message?: string
  data?: {
    items: UsageLog[]
    total: number
    page: number
    page_size: number
  }
}

export interface SearchLogsParams {
  keyword: string
}

export interface GetLogStatsParams {
  type?: number
  username?: string
  token_name?: string
  model_name?: string
  start_timestamp?: number
  end_timestamp?: number
  channel?: number
  group?: string
}

export interface GetLogStatsResponse {
  success: boolean
  message?: string
  data?: LogStatistics
}

// ============================================================================
// Log Management APIs
// ============================================================================

/**
 * Get paginated logs list (admin)
 */
export async function getAllLogs(
  params: GetLogsParams = {}
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams({
    p: params.p || 1,
    page_size: params.page_size || 10,
    type: params.type,
    username: params.username,
    token_name: params.token_name,
    model_name: params.model_name,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    channel: params.channel,
    group: params.group,
  })

  const res = await api.get(`/api/log/?${queryParams.toString()}`)
  return res.data
}

/**
 * Get user's own logs
 */
export async function getUserLogs(
  params: Omit<GetLogsParams, 'username' | 'channel'> = {}
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams({
    p: params.p || 1,
    page_size: params.page_size || 10,
    type: params.type,
    token_name: params.token_name,
    model_name: params.model_name,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    group: params.group,
  })

  const res = await api.get(`/api/log/self/?${queryParams.toString()}`)
  return res.data
}

// Search logs by keyword (admin)
export async function searchAllLogs(
  params: SearchLogsParams
): Promise<{ success: boolean; message?: string; data?: UsageLog[] }> {
  const { keyword = '' } = params
  const res = await api.get(
    `/api/log/search?keyword=${encodeURIComponent(keyword)}`
  )
  return res.data
}

// Search user's own logs
export async function searchUserLogs(
  params: SearchLogsParams
): Promise<{ success: boolean; message?: string; data?: UsageLog[] }> {
  const { keyword = '' } = params
  const res = await api.get(
    `/api/log/self/search?keyword=${encodeURIComponent(keyword)}`
  )
  return res.data
}

/**
 * Get log statistics (admin)
 */
export async function getLogStats(
  params: GetLogStatsParams = {}
): Promise<GetLogStatsResponse> {
  const queryParams = buildQueryParams({
    type: params.type,
    username: params.username,
    token_name: params.token_name,
    model_name: params.model_name,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    channel: params.channel,
    group: params.group,
  })

  const res = await api.get(`/api/log/stat?${queryParams.toString()}`)
  return res.data
}

/**
 * Get user's own log statistics
 */
export async function getUserLogStats(
  params: Omit<GetLogStatsParams, 'username' | 'channel'> = {}
): Promise<GetLogStatsResponse> {
  const queryParams = buildQueryParams({
    type: params.type,
    token_name: params.token_name,
    model_name: params.model_name,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    group: params.group,
  })

  const res = await api.get(`/api/log/self/stat?${queryParams.toString()}`)
  return res.data
}

/**
 * Get logs by API key
 */
export async function getLogsByKey(
  key: string
): Promise<{ success: boolean; message?: string; data?: UsageLog[] }> {
  const res = await api.get(`/api/log/key?key=${encodeURIComponent(key)}`)
  return res.data
}

/**
 * Delete old logs (admin only)
 */
export async function deleteHistoryLogs(
  targetTimestamp: number
): Promise<{ success: boolean; message?: string; data?: number }> {
  const res = await api.delete(
    `/api/log/history?target_timestamp=${targetTimestamp}`
  )
  return res.data
}
