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
    ...params,
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
    ...params,
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
  const queryParams = buildQueryParams(params)
  const res = await api.get(`/api/log/stat?${queryParams.toString()}`)
  return res.data
}

/**
 * Get user's own log statistics
 */
export async function getUserLogStats(
  params: Omit<GetLogStatsParams, 'username' | 'channel'> = {}
): Promise<GetLogStatsResponse> {
  const queryParams = buildQueryParams(params)
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

/**
 * Get all Midjourney logs (admin only)
 */
export async function getAllMidjourneyLogs(
  params: GetMidjourneyLogsParams
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams(params)
  const res = await api.get(`/api/mj/?${queryParams}`)
  return res.data
}

/**
 * Get user's own Midjourney logs
 */
export async function getUserMidjourneyLogs(
  params: GetMidjourneyLogsParams
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams(params)
  const res = await api.get(`/api/mj/self/?${queryParams}`)
  return res.data
}

// ============================================================================
// Task Logs API
// ============================================================================

/**
 * Get all task logs (admin only)
 */
export async function getAllTaskLogs(
  params: GetTaskLogsParams
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams(params)
  const res = await api.get(`/api/task/?${queryParams}`)
  return res.data
}

/**
 * Get user's own task logs
 */
export async function getUserTaskLogs(
  params: GetTaskLogsParams
): Promise<GetLogsResponse> {
  const queryParams = buildQueryParams(params)
  const res = await api.get(`/api/task/self?${queryParams}`)
  return res.data
}
