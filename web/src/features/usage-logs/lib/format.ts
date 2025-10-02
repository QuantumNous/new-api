import type { UsageLog, LogOtherData } from '../data/schema'

/**
 * Parse the 'other' field from JSON string to object
 */
export function parseLogOther(other: string): LogOtherData | null {
  if (!other) return null
  try {
    return JSON.parse(other) as LogOtherData
  } catch (error) {
    console.error('Failed to parse log other field:', error)
    return null
  }
}

/**
 * Format quota for usage logs with higher precision
 * Uses 6 decimal places to show very small costs accurately
 */
export function formatLogQuota(quota: number): string {
  const dollars = quota / 500000

  // For very large amounts, use compact notation
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`
  }

  // For amounts >= $0.01, use 4 decimal places
  if (dollars >= 0.01) {
    return `$${dollars.toFixed(4)}`
  }

  // For very small amounts, use 6 decimal places to show precise costs
  // If result is 0 but quota > 0, show minimum representable value
  const result = dollars.toFixed(6)
  if (parseFloat(result) === 0 && quota > 0) {
    return `$${(0.000001).toFixed(6)}`
  }

  return `$${result}`
}

/**
 * Format tokens count
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return '-'
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1000000).toFixed(2)}M`
}

/**
 * Format use time in seconds
 */
export function formatUseTime(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

/**
 * Get time color based on duration (in seconds)
 */
export function getTimeColor(
  seconds: number
): 'success' | 'info' | 'warning' | 'danger' {
  if (seconds < 3) return 'success'
  if (seconds < 10) return 'info'
  return 'warning'
}

/**
 * Format model name with mapping indicator
 */
export function formatModelName(log: UsageLog): {
  name: string
  isMapped: boolean
  actualModel?: string
} {
  const other = parseLogOther(log.other)
  const isMapped = !!(
    other?.is_model_mapped &&
    other?.upstream_model_name &&
    other.upstream_model_name !== ''
  )

  return {
    name: log.model_name,
    isMapped,
    actualModel: isMapped ? other.upstream_model_name : undefined,
  }
}
