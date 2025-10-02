/**
 * Utility functions for usage logs feature
 */
import type { GetLogsParams } from '../api'

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
  const params: GetLogsParams = {
    p: page,
    page_size: pageSize,
  }

  // Add search params (from filter dialog)
  if (searchParams.type && Array.isArray(searchParams.type)) {
    params.type =
      searchParams.type.length === 1 ? Number(searchParams.type[0]) : 0
  }
  if (searchParams.model) {
    params.model_name = String(searchParams.model)
  }
  if (searchParams.token) {
    params.token_name = String(searchParams.token)
  }
  if (searchParams.group) {
    params.group = String(searchParams.group)
  }
  if (isAdmin && searchParams.channel) {
    params.channel = Number(searchParams.channel) || 0
  }
  if (isAdmin && searchParams.username) {
    params.username = String(searchParams.username)
  }
  if (searchParams.startTime) {
    params.start_timestamp = timestampToSeconds(searchParams.startTime)
  }
  if (searchParams.endTime) {
    params.end_timestamp = timestampToSeconds(searchParams.endTime)
  }

  // Add column filters (from table filters if any)
  columnFilters.forEach((filter) => {
    const value = filter.value
    if (value !== undefined && value !== null && value !== '') {
      if (filter.id === 'type' && Array.isArray(value)) {
        params.type = value.length === 1 ? Number(value[0]) : 0
      } else if (filter.id === 'model_name') {
        params.model_name = String(value)
      } else if (filter.id === 'token_name') {
        params.token_name = String(value)
      } else if (filter.id === 'group') {
        params.group = String(value)
      } else if (isAdmin && filter.id === 'channel') {
        params.channel = Number(value) || 0
      } else if (isAdmin && filter.id === 'username') {
        params.username = String(value)
      }
    }
  })

  return params
}
