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
  GetLogExportFieldsResponse,
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

export async function getCommonLogExportFields(
  isAdmin: boolean
): Promise<GetLogExportFieldsResponse> {
  const path = isAdmin
    ? '/api/log/export_fields'
    : '/api/log/self/export_fields'
  const res = await api.get(path)
  return res.data
}

export async function exportCommonLogsXlsx(
  params: GetLogsParams,
  fields: string[],
  isAdmin: boolean
): Promise<{ blob: Blob; filename: string }> {
  const path = isAdmin ? '/api/log/export' : '/api/log/self/export'
  const queryParams = buildQueryParams({
    ...params,
    fields: fields.join(','),
  })
  queryParams.set('timezone', getBrowserTimezone())
  let res
  try {
    res = await api.get(`${path}?${queryParams}`, {
      responseType: 'blob',
      disableDuplicate: true,
      skipBusinessError: true,
      skipErrorHandler: true,
    })
  } catch (error) {
    throw new Error(await getBlobErrorMessage(error))
  }
  const blob = res.data as Blob
  const contentType = String(res.headers['content-type'] || blob.type || '')
  if (contentType.includes('application/json')) {
    const text = await blob.text()
    let message = text || 'Export failed'
    try {
      const payload = JSON.parse(text) as { message?: string }
      message = payload.message || message
    } catch {
      // Keep raw text when the response is not valid JSON.
    }
    throw new Error(message)
  }

  return {
    blob,
    filename: getDownloadFilename(
      String(res.headers['content-disposition'] || ''),
      'usage-logs.xlsx'
    ),
  }
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

async function getBlobErrorMessage(error: unknown): Promise<string> {
  const response = (error as { response?: { data?: unknown } })?.response
  const data = response?.data
  if (data instanceof Blob) {
    const text = await data.text()
    if (!text) return 'Export failed'
    try {
      const payload = JSON.parse(text) as { message?: string }
      return payload.message || text
    } catch {
      return text
    }
  }
  return error instanceof Error ? error.message : 'Export failed'
}

function getDownloadFilename(disposition: string, fallback: string): string {
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  const quoted = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  return quoted || fallback
}

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
