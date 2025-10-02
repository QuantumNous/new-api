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
 * Format quota to display with proper currency symbol
 */
export function formatQuota(quota: number, decimals: number = 6): string {
  const value = quota / 500000
  if (decimals === 0) {
    return `$${value.toFixed(0)}`
  }
  return `$${value.toFixed(decimals)}`
}

/**
 * Format number with commas for thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
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
 * Get time color based on duration
 */
export function getUseTimeColor(
  seconds: number
): 'success' | 'info' | 'warning' | 'danger' {
  if (seconds < 3) return 'success'
  if (seconds < 10) return 'info'
  return 'warning'
}

/**
 * Get first response time color
 */
export function getFirstResponseTimeColor(
  milliseconds: number
): 'success' | 'info' | 'warning' | 'danger' {
  const seconds = milliseconds / 1000
  if (seconds < 3) return 'success'
  if (seconds < 10) return 'info'
  return 'warning'
}

/**
 * Check if log has expandable details
 */
export function hasExpandableDetails(log: UsageLog): boolean {
  if (log.type !== 2) return false // Only consume logs have details

  const other = parseLogOther(log.other)
  if (!other) return false

  // Check for various detail types
  return !!(
    other.cache_tokens ||
    other.cache_creation_tokens ||
    other.audio ||
    other.ws ||
    other.is_model_mapped ||
    other.admin_info
  )
}

/**
 * Generate log detail items for expanded view
 */
export function generateLogDetails(log: UsageLog): Array<{
  key: string
  value: string | number | React.ReactNode
}> {
  const details: Array<{ key: string; value: string | number }> = []
  const other = parseLogOther(log.other)

  if (!other || log.type !== 2) return details

  // Channel information (admin only)
  if (other.admin_info && log.channel) {
    details.push({
      key: 'Channel',
      value: `${log.channel} - ${log.channel_name || '[Unknown]'}`,
    })
  }

  // Audio/Voice information
  if (other.audio || other.ws) {
    if (other.audio_input)
      details.push({ key: 'Voice Input', value: other.audio_input })
    if (other.audio_output)
      details.push({ key: 'Voice Output', value: other.audio_output })
    if (other.text_input)
      details.push({ key: 'Text Input', value: other.text_input })
    if (other.text_output)
      details.push({ key: 'Text Output', value: other.text_output })
  }

  // Cache tokens
  if (other.cache_tokens && other.cache_tokens > 0) {
    details.push({
      key: 'Cache Tokens',
      value: formatTokens(other.cache_tokens),
    })
  }

  if (other.cache_creation_tokens && other.cache_creation_tokens > 0) {
    details.push({
      key: 'Cache Creation Tokens',
      value: formatTokens(other.cache_creation_tokens),
    })
  }

  // Model mapping
  if (other.is_model_mapped && other.upstream_model_name) {
    details.push({ key: 'Request Model', value: log.model_name })
    details.push({ key: 'Actual Model', value: other.upstream_model_name })
  }

  // Reasoning effort
  if (other.reasoning_effort) {
    details.push({ key: 'Reasoning Effort', value: other.reasoning_effort })
  }

  // Retry information (admin only)
  if (
    other.admin_info?.use_channel &&
    other.admin_info.use_channel.length > 0
  ) {
    const channelPath = other.admin_info.use_channel.join(' → ')
    details.push({ key: 'Channel Retry Path', value: channelPath })
  }

  return details
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

/**
 * Get pricing calculation details for tooltip
 */
export function getPricingTooltip(log: UsageLog): string | null {
  const other = parseLogOther(log.other)
  if (!other || log.type !== 2) return null

  const lines: string[] = []

  if (other.model_price) {
    lines.push(`Model Price: ${other.model_price}`)
  }

  if (other.model_ratio) {
    lines.push(`Model Ratio: ${other.model_ratio}`)
  }

  if (other.completion_ratio && other.completion_ratio !== 1) {
    lines.push(`Completion Ratio: ${other.completion_ratio}`)
  }

  if (other.group_ratio && other.group_ratio !== 1) {
    lines.push(`Group Ratio: ${other.group_ratio}`)
  }

  if (other.user_group_ratio && other.user_group_ratio !== 1) {
    lines.push(`User Group Ratio: ${other.user_group_ratio}`)
  }

  if (other.cache_ratio && other.cache_ratio !== 1) {
    lines.push(`Cache Ratio: ${other.cache_ratio}`)
  }

  return lines.length > 0 ? lines.join('\n') : null
}
