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

/**
 * True when a response is the backend's admin-only rejection. A normal user can
 * reach an admin log endpoint if their cached `role` is briefly stale (e.g. a
 * demoted admin whose localStorage still says role>=10, or a first render before
 * the session guard refreshes `user`). In that case we transparently retry the
 * `/self` variant instead of surfacing "无权进行此操作，权限不足" on the user's
 * own log page.
 */
function isInsufficientPrivilege(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const record = data as { success?: boolean; message?: string }
  if (record.success !== false) return false
  const message = record.message ?? ''
  return (
    message.includes('权限不足') ||
    message.includes('權限不足') ||
    message.toLowerCase().includes('insufficient privilege')
  )
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
  const res = await api.get(`${buildApiPath(endpoint, isAdmin)}?${queryParams}`)
  if (isAdmin && isInsufficientPrivilege(res.data)) {
    const fallback = await api.get(`${buildApiPath(endpoint, false)}?${queryParams}`)
    return fallback.data
  }
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
  const res = await api.get(`${buildApiPath(endpoint, isAdmin)}/stat?${queryParams}`)
  if (isAdmin && isInsufficientPrivilege(res.data)) {
    const fallback = await api.get(`${buildApiPath(endpoint, false)}/stat?${queryParams}`)
    return fallback.data
  }
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
