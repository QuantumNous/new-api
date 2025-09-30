/**
 * Time utility functions for consistent time handling across the application
 */

/**
 * 时间粒度类型
 */
export type TimeGranularity = 'hour' | 'day' | 'week'

/**
 * Convert Date object to Unix timestamp (seconds)
 */
export function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

/**
 * Get start of day for a Unix timestamp (seconds)
 * Sets time to 00:00:00
 */
export function toStartOfDay(tsSec: number): number {
  const d = new Date(tsSec * 1000)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

/**
 * Get start of day for a Date object
 * Returns new Date with time set to 00:00:00
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get end of day for a Date object
 * Returns new Date with time set to 23:59:59.999
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Calculate date range with start and end of day normalization
 * @param days Number of days to go back
 * @param fromDate Starting point (defaults to now)
 * @returns Object with normalized start (00:00:00) and end (23:59:59) dates
 */
export function getNormalizedDateRange(
  days: number,
  fromDate: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(fromDate)
  const start = new Date(fromDate)
  start.setDate(end.getDate() - days)

  return {
    start: getStartOfDay(start),
    end: getEndOfDay(end),
  }
}

/**
 * Compute time range as Unix timestamps (seconds)
 * @param days Default number of days if no dates provided
 * @param startDate Optional start date
 * @param endDate Optional end date
 * @param useStartOfDay Whether to normalize to start/end of day
 * @returns Object with start_timestamp and end_timestamp in seconds
 */
export function computeTimeRange(
  days: number,
  startDate?: Date,
  endDate?: Date,
  useStartOfDay = false
): { start_timestamp: number; end_timestamp: number } {
  const now = Math.floor(Date.now() / 1000)

  if (useStartOfDay) {
    const defaultEnd = toStartOfDay(now)
    const end = endDate
      ? toStartOfDay(dateToUnixTimestamp(endDate))
      : defaultEnd
    const start = startDate
      ? toStartOfDay(dateToUnixTimestamp(startDate))
      : end - days * 24 * 3600

    return {
      start_timestamp: start,
      end_timestamp: end + 24 * 3600 - 1, // End of day
    }
  }

  // Normal mode without day normalization
  const end = endDate ? dateToUnixTimestamp(endDate) : now
  const start = startDate
    ? dateToUnixTimestamp(startDate)
    : end - days * 24 * 3600

  return { start_timestamp: start, end_timestamp: end }
}

/**
 * Format Unix timestamp (seconds) to localized date string
 */
export function formatDate(tsSec: number): string {
  const d = new Date(tsSec * 1000)
  return d.toLocaleDateString()
}

/**
 * Format Date object to localized date and time string
 */
export function formatDateTimeObject(date: Date): string {
  return date.toLocaleString()
}

/**
 * Format timestamp for chart display based on time granularity
 * @param timestamp Unix timestamp in seconds
 * @param granularity Time granularity: 'hour', 'day', or 'week'
 * @returns Formatted string suitable for chart axis
 */
export function formatChartTime(
  timestamp: number,
  granularity: TimeGranularity = 'day'
): string {
  const date = new Date(timestamp * 1000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')

  let result = `${month}-${day}`

  if (granularity === 'hour') {
    result += ` ${hour}:00`
  } else if (granularity === 'week') {
    // Add week end date (6 days later)
    const weekEnd = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000)
    const endMonth = String(weekEnd.getMonth() + 1).padStart(2, '0')
    const endDay = String(weekEnd.getDate()).padStart(2, '0')
    result += ` - ${endMonth}-${endDay}`
  }

  return result
}
