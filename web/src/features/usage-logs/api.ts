import { api } from '@/lib/api'
import type { UsageLog } from './data/schema'
import { buildQueryParams } from './lib/utils'
import type {
  GetLogsParams,
  GetLogsResponse,
  SearchLogsParams,
  GetLogStatsParams,
  GetLogStatsResponse,
  GetMidjourneyLogsParams,
  GetTaskLogsParams,
  UserInfo,
} from './types'

// ============================================================================
// Generic API Helpers
// ============================================================================

/**
 * Build API path based on admin status
 */
function buildApiPath(endpoint: string, isAdmin: boolean): string {
  return isAdmin ? endpoint : `${endpoint}/self`
}

/**
 * Generic function to fetch logs with pagination
 */
async function fetchLogs<T extends Record<string, any>>(
  endpoint: string,
  params: T,
  isAdmin: boolean
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams({
    p: (params as any).p || 1,
    page_size: (params as any).page_size || 10,
    ...params,
  })
  const path = buildApiPath(endpoint, isAdmin)
  const res = await api.get(`${path}?${queryParams}`)
  return res.data
}

/**
 * Generic function to search logs
 */
async function searchLogs(
  endpoint: string,
  keyword: string,
  isAdmin: boolean
): Promise<{ success: boolean; message?: string; data?: UsageLog[] }> {
  const path = buildApiPath(endpoint, isAdmin)
  const res = await api.get(
    `${path}/search?keyword=${encodeURIComponent(keyword)}`
  )
  return res.data
}

/**
 * Generic function to get log statistics
 */
async function fetchLogStats<T extends Record<string, any>>(
  endpoint: string,
  params: T,
  isAdmin: boolean
): Promise<GetLogStatsResponse> {
  const queryParams = buildQueryParams(params)
  const path = buildApiPath(endpoint, isAdmin)
  const res = await api.get(`${path}/stat?${queryParams}`)
  return res.data
}

// ============================================================================
// Log Management APIs
// ============================================================================

export const getAllLogs = (params: GetLogsParams = {}) =>
  fetchLogs('/api/log/', params, true)

export const getUserLogs = (
  params: Omit<GetLogsParams, 'username' | 'channel'> = {}
) => fetchLogs('/api/log/', params, false)

export const searchAllLogs = (params: SearchLogsParams) =>
  searchLogs('/api/log', params.keyword || '', true)

export const searchUserLogs = (params: SearchLogsParams) =>
  searchLogs('/api/log', params.keyword || '', false)

export const getLogStats = (params: GetLogStatsParams = {}) =>
  fetchLogStats('/api/log', params, true)

export const getUserLogStats = (
  params: Omit<GetLogStatsParams, 'username' | 'channel'> = {}
) => fetchLogStats('/api/log', params, false)

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

/**
 * Get user information by user ID (admin only)
 */
export async function getUserInfo(
  userId: number
): Promise<{ success: boolean; message?: string; data?: UserInfo }> {
  const res = await api.get(`/api/user/${userId}`)
  return res.data
}

// ============================================================================
// Midjourney (Drawing) Logs API
// ============================================================================

export const getAllMidjourneyLogs = (params: GetMidjourneyLogsParams) =>
  fetchLogs('/api/mj/', params, true)

export const getUserMidjourneyLogs = (params: GetMidjourneyLogsParams) =>
  fetchLogs('/api/mj/', params, false)

// ============================================================================
// Task Logs API
// ============================================================================

export const getAllTaskLogs = (params: GetTaskLogsParams) =>
  fetchLogs('/api/task/', params, true)

export const getUserTaskLogs = (params: GetTaskLogsParams) =>
  fetchLogs('/api/task/', params, false)
