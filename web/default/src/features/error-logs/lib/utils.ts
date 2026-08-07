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
import type { ErrorLogFilters, ErrorLogOtherData, GetErrorLogsParams } from '../types'

export function getDefaultTimeRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now.getTime() + 3600 * 1000)
  return { start, end }
}

export function parseErrorLogOther(other: string): ErrorLogOtherData | null {
  if (!other) return null
  try {
    return JSON.parse(other) as ErrorLogOtherData
  } catch {
    return null
  }
}

export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

export function buildSearchParams(
  filters: ErrorLogFilters
): Record<string, unknown> {
  return {
    ...(filters.startTime && { startTime: filters.startTime.getTime() }),
    ...(filters.endTime && { endTime: filters.endTime.getTime() }),
    ...(filters.errorCategory && { errorCategory: filters.errorCategory }),
    ...(filters.username && { username: filters.username }),
    ...(filters.model && { model: filters.model }),
    ...(filters.channel && { channel: filters.channel }),
    ...(filters.token && { token: filters.token }),
    ...(filters.requestId && { requestId: filters.requestId }),
    ...(filters.keyword && { keyword: filters.keyword }),
  }
}

export function buildApiParams(config: {
  page: number
  pageSize: number
  searchParams: Record<string, unknown>
}): GetErrorLogsParams {
  const { page, pageSize, searchParams } = config
  const hasTimeParams = searchParams.startTime ?? searchParams.endTime
  const defaultTimeRange = !hasTimeParams ? getDefaultTimeRange() : null

  const toSeconds = (ms?: unknown, fallback?: Date) => {
    const time = (ms as number) || fallback?.getTime()
    return time ? Math.floor(time / 1000) : undefined
  }

  return {
    p: page,
    page_size: pageSize,
    start_timestamp: toSeconds(searchParams.startTime, defaultTimeRange?.start),
    end_timestamp: toSeconds(searchParams.endTime, defaultTimeRange?.end),
    ...(searchParams.model
      ? { model_name: String(searchParams.model) }
      : {}),
    ...(searchParams.username
      ? { username: String(searchParams.username) }
      : {}),
    ...(searchParams.token
      ? { token_name: String(searchParams.token) }
      : {}),
    ...(searchParams.channel
      ? { channel: Number(searchParams.channel) || 0 }
      : {}),
    ...(searchParams.requestId
      ? { request_id: String(searchParams.requestId) }
      : {}),
    ...(searchParams.keyword ? { keyword: String(searchParams.keyword) } : {}),
    ...(searchParams.errorCategory
      ? { error_category: String(searchParams.errorCategory) }
      : {}),
  }
}
