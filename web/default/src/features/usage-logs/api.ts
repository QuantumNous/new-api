/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'
import { buildQueryParams } from './lib/utils'
import type {
  GetLogsParams,
  GetLogsResponse,
  GetLogStatsParams,
  GetLogStatsResponse,
  GetLogStatisticsParams,
  GetLogStatisticsResponse,
  GetMidjourneyLogsParams,
  GetTaskLogsParams,
  UserInfo,
} from './types'

// ============================================================================
// Generic API Helpers
// ============================================================================

function buildApiPath(endpoint: string, isAdmin: boolean): string {
  return isAdmin ? endpoint : `${endpoint}/self`
}

async function fetchLogs<T>(
  endpoint: string,
  params: T,
  isAdmin: boolean
): Promise<GetLogsResponse> {
  const paramRecord = params as unknown as Record<string, unknown>
  const queryParams = buildQueryParams({
    p: paramRecord.p || 1,
    page_size: paramRecord.page_size || 20,
    ...params,
  })
  const path = buildApiPath(endpoint, isAdmin)
  const res = await api.get(`${path}?${queryParams}`)
  return res.data
}

async function fetchLogStats<T>(
  endpoint: string,
  params: T,
  isAdmin: boolean
): Promise<GetLogStatsResponse> {
  const queryParams = buildQueryParams(
    params as unknown as Record<string, unknown>
  )
  const path = buildApiPath(endpoint, isAdmin)
  const res = await api.get(`${path}/stat?${queryParams}`)
  return res.data
}

// ============================================================================
// Common Log APIs
// ============================================================================

export const getAllLogs = (params: GetLogsParams = {}) =>
  fetchLogs('/api/log', params, true)

export const getUserLogs = (
  params: Omit<GetLogsParams, 'username' | 'channel'> = {}
) => fetchLogs('/api/log', params, false)

export const getLogStats = (params: GetLogStatsParams = {}) =>
  fetchLogStats('/api/log', params, true)

export const getUserLogStats = (
  params: Omit<GetLogStatsParams, 'username' | 'channel'> = {}
) => fetchLogStats('/api/log', params, false)

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
  fetchLogs('/api/mj', params, true)

export const getUserMidjourneyLogs = (params: GetMidjourneyLogsParams) =>
  fetchLogs('/api/mj', params, false)

// ============================================================================
// Task Logs API
// ============================================================================

export const getAllTaskLogs = (params: GetTaskLogsParams) =>
  fetchLogs('/api/task', params, true)

export const getUserTaskLogs = (params: GetTaskLogsParams) =>
  fetchLogs('/api/task', params, false)

// ============================================================================
// Log Statistics API (admin)
// ============================================================================

export async function getLogStatistics(
  params: GetLogStatisticsParams
): Promise<GetLogStatisticsResponse> {
  const queryParams = buildQueryParams(
    params as unknown as Record<string, unknown>
  )
  const res = await api.get(`/api/log/statistics?${queryParams}`)
  return res.data
}

export async function exportLogStatistics(
  params: GetLogStatisticsParams
): Promise<void> {
  const queryParams = buildQueryParams(
    params as unknown as Record<string, unknown>
  )
  const res = await api.get(`/api/log/statistics/export?${queryParams}`, {
    responseType: 'blob',
  })
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const contentDisposition = res.headers['content-disposition']
  let filename = `usage_statistics_${params.username}.xlsx`
  if (contentDisposition) {
    const utf8Match = contentDisposition.match(
      /filename\*=UTF-8''(.+?)(?:;|$)/
    )
    if (utf8Match) {
      filename = decodeURIComponent(utf8Match[1])
    } else {
      const match = contentDisposition.match(/filename="?([^";]+)"?/)
      if (match) filename = decodeURIComponent(match[1])
    }
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// ============================================================================
// Statistics Options API (for combobox dropdowns)
// ============================================================================

export async function getStatisticsUserOptions(
  keyword?: string
): Promise<string[]> {
  const queryParams = buildQueryParams({
    keyword: keyword || '',
    page_size: 50,
  })
  const res = await api.get(
    `/api/log/statistics/options/users?${queryParams}`
  )
  return res.data?.data ?? []
}

export async function getStatisticsTokenOptions(
  username?: string
): Promise<string[]> {
  const queryParams = buildQueryParams({
    username: username || '',
  })
  const res = await api.get(
    `/api/log/statistics/options/tokens?${queryParams}`
  )
  return res.data?.data ?? []
}

export async function getStatisticsModelOptions(
  username?: string,
  tokenName?: string
): Promise<string[]> {
  const queryParams = buildQueryParams({
    username: username || '',
    token_name: tokenName || '',
  })
  const res = await api.get(
    `/api/log/statistics/options/models?${queryParams}`
  )
  return res.data?.data ?? []
}
