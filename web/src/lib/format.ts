// ============================================================================
// Number Formatting
// ============================================================================

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    value as number
  )
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value as number)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format((value as number) / 100)
}

export function formatCurrencyUSD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value as number)
}

// ============================================================================
// Quota Formatting (500,000 units = $1)
// ============================================================================

/**
 * Format quota to dollar amount
 * Quota is stored in units where 500,000 = $1
 */
export function formatQuota(quota: number): string {
  const dollars = quota / 500000
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`
  }
  if (dollars >= 1) {
    return `$${dollars.toFixed(2)}`
  }
  return `$${dollars.toFixed(4)}`
}

/**
 * Parse quota from dollar input
 */
export function parseQuotaFromDollars(dollars: number): number {
  return Math.round(dollars * 500000)
}

/**
 * Convert quota units to dollars
 * Reverse of parseQuotaFromDollars
 */
export function quotaUnitsToDollars(units: number): number {
  return units / 500000
}

// ============================================================================
// Timestamp Formatting
// ============================================================================

/**
 * Format Unix timestamp to locale string
 */
export function formatTimestamp(timestamp: number): string {
  if (timestamp === -1) {
    return 'Never'
  }
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

/**
 * Format timestamp to consistent date string (YYYY-MM-DD HH:mm:ss)
 * This format matches usage-logs display style
 * @param timestamp - Timestamp in seconds or milliseconds
 * @param unit - Unit of the timestamp ('seconds' or 'milliseconds')
 */
export function formatTimestampToDate(
  timestamp?: number,
  unit: 'seconds' | 'milliseconds' = 'seconds'
): string {
  if (!timestamp || timestamp === -1 || timestamp === 0) {
    return '-'
  }
  const date = new Date(unit === 'seconds' ? timestamp * 1000 : timestamp)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * Format quota for usage logs with higher precision
 * Uses 6 decimal places to show very small costs accurately
 */
export function formatLogQuota(quota: number): string {
  const dollars = quota / 500000

  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`
  if (dollars >= 0.01) return `$${dollars.toFixed(4)}`

  // For very small amounts, use 6 decimal places
  const result = dollars.toFixed(6)
  return parseFloat(result) === 0 && quota > 0
    ? `$${(0.000001).toFixed(6)}`
    : `$${result}`
}

/**
 * Format tokens count with K/M suffixes
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return '-'
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1000000).toFixed(2)}M`
}

/**
 * Format use time in seconds with appropriate unit
 */
export function formatUseTime(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

/**
 * Format timestamp to date input value (YYYY-MM-DDTHH:mm)
 */
export function formatTimestampForInput(timestamp: number): string {
  if (timestamp === -1) {
    return ''
  }
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Parse datetime-local input to Unix timestamp
 */
export function parseTimestampFromInput(value: string): number {
  if (!value) {
    return -1
  }
  const date = new Date(value)
  return Math.floor(date.getTime() / 1000)
}
