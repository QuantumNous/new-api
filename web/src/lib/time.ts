/**
 * Time utility functions for consistent time handling across the application
 */

/**
 * Convert Date object to Unix timestamp (seconds)
 */
export function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

/**
 * Convert Unix timestamp (seconds) to Date object
 */
export function unixTimestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000)
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
 * Get end of day for a Unix timestamp (seconds)
 * Sets time to 23:59:59.999
 */
export function toEndOfDay(tsSec: number): number {
  const d = new Date(tsSec * 1000)
  d.setHours(23, 59, 59, 999)
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
 * Calculate date range from current date
 * @param days Number of days to go back
 * @param fromDate Starting point (defaults to now)
 * @returns Object with start and end dates
 */
export function getDateRangeFromNow(
  days: number,
  fromDate: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(fromDate)
  const start = new Date(fromDate)
  start.setDate(end.getDate() - days)
  return { start, end }
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
  const { start: rawStart, end: rawEnd } = getDateRangeFromNow(days, fromDate)
  return {
    start: getStartOfDay(rawStart),
    end: getEndOfDay(rawEnd),
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
 * Format Unix timestamp (seconds) to localized date and time string
 */
export function formatDateTime(tsSec: number): string {
  const d = new Date(tsSec * 1000)
  return d.toLocaleString()
}

/**
 * Format Date object to localized date string
 */
export function formatDateObject(date: Date): string {
  return date.toLocaleDateString()
}

/**
 * Format Date object to localized date and time string
 */
export function formatDateTimeObject(date: Date): string {
  return date.toLocaleString()
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if a date is within the last N days
 */
export function isWithinDays(date: Date, days: number): boolean {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const daysDiff = diff / (1000 * 60 * 60 * 24)
  return daysDiff >= 0 && daysDiff <= days
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Subtract days from a date
 */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days)
}
