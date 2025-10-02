/**
 * Utility functions for usage logs feature
 */
import type { GetLogsParams } from '../types'

/**
 * Check if log type is displayable (has detailed info)
 */
export function isDisplayableLogType(type: number): boolean {
  return type === 0 || type === 2 || type === 5
}

/**
 * Check if log type shows timing info
 */
export function isTimingLogType(type: number): boolean {
  return type === 2 || type === 5
}

/**
 * Get default time range (today 00:00:00 to now + 1 hour)
 */
export function getDefaultTimeRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now.getTime() + 3600 * 1000) // +1 hour

  return { start, end }
}

/**
 * Convert milliseconds timestamp to seconds for API
 */
export function timestampToSeconds(ms: number | undefined): number | undefined {
  return ms ? Math.floor(ms / 1000) : undefined
}

/**
 * Build query parameters from filters
 */
export function buildQueryParams(params: Record<string, any>): URLSearchParams {
  const queryParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 0) {
      queryParams.append(key, String(value))
    }
  })

  return queryParams
}

/**
 * Build API params from search params and column filters
 */
export function buildApiParams(config: {
  page: number
  pageSize: number
  searchParams: Record<string, any>
  columnFilters?: Array<{ id: string; value: any }>
  isAdmin: boolean
}): GetLogsParams {
  const { page, pageSize, searchParams, columnFilters = [], isAdmin } = config

  // Helper to process type parameter
  const processType = (value: any) =>
    Array.isArray(value) && value.length === 1 ? Number(value[0]) : 0

  // Build base params from search params
  const params: GetLogsParams = {
    p: page,
    page_size: pageSize,
    ...(searchParams.type && { type: processType(searchParams.type) }),
    ...(searchParams.model && { model_name: String(searchParams.model) }),
    ...(searchParams.token && { token_name: String(searchParams.token) }),
    ...(searchParams.group && { group: String(searchParams.group) }),
    ...(isAdmin &&
      searchParams.channel && { channel: Number(searchParams.channel) || 0 }),
    ...(isAdmin &&
      searchParams.username && { username: String(searchParams.username) }),
    ...(searchParams.startTime && {
      start_timestamp: timestampToSeconds(searchParams.startTime),
    }),
    ...(searchParams.endTime && {
      end_timestamp: timestampToSeconds(searchParams.endTime),
    }),
  }

  // Override with column filters if present
  columnFilters.forEach((filter) => {
    const { id, value } = filter
    if (value === undefined || value === null || value === '') return

    switch (id) {
      case 'type':
        params.type = processType(value)
        break
      case 'model_name':
        params.model_name = String(value)
        break
      case 'token_name':
        params.token_name = String(value)
        break
      case 'group':
        params.group = String(value)
        break
      case 'channel':
        if (isAdmin) params.channel = Number(value) || 0
        break
      case 'username':
        if (isAdmin) params.username = String(value)
        break
    }
  })

  return params
}
