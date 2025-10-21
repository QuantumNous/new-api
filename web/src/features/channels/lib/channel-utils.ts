import { formatDistanceToNow } from 'date-fns'
import {
  CHANNEL_STATUS_CONFIG,
  CHANNEL_TYPES,
  MULTI_KEY_STATUS_CONFIG,
  RESPONSE_TIME_CONFIG,
  RESPONSE_TIME_THRESHOLDS,
} from '../constants'
import type { Channel, ChannelSettings, ChannelOtherSettings } from '../types'

// ============================================================================
// Channel Type Utilities
// ============================================================================

/**
 * Get human-readable channel type label
 */
export function getChannelTypeLabel(type: number): string {
  return CHANNEL_TYPES[type as keyof typeof CHANNEL_TYPES] || 'Unknown'
}

/**
 * Get channel type icon name for getLobeIcon
 * Maps channel types to Lobe icon names
 */
export function getChannelTypeIcon(type: number): string {
  const typeLabel = getChannelTypeLabel(type)
  const iconMap: Record<string, string> = {
    // OpenAI family
    OpenAI: 'OpenAI',
    OpenAIMax: 'OpenAI',
    OhMyGPT: 'OpenAI',
    Custom: 'OpenAI',
    Azure: 'Azure.Color',

    // Anthropic
    Anthropic: 'Claude.Color',

    // Google family
    Gemini: 'Gemini.Color',
    PaLM: 'Google.Color',
    'Vertex AI': 'Gemini.Color',

    // Cloud providers
    AWS: 'Aws.Color',
    Cloudflare: 'Cloudflare.Color',

    // Chinese providers
    Baidu: 'Baidu.Color',
    'Baidu V2': 'Baidu.Color',
    Zhipu: 'Zhipu.Color',
    'Zhipu V4': 'Zhipu.Color',
    Ali: 'Qwen.Color',
    Xunfei: 'Spark.Color',
    Tencent: 'Hunyuan.Color',
    '360': 'Ai360',
    Moonshot: 'Moonshot.Color',
    LingYiWanWu: 'Yi.Color',
    MiniMax: 'Minimax.Color',
    VolcEngine: 'Doubao.Color',

    // Other AI providers
    Ollama: 'Ollama',
    Perplexity: 'Perplexity.Color',
    Cohere: 'Cohere.Color',
    Mistral: 'Mistral.Color',
    DeepSeek: 'DeepSeek.Color',
    xAI: 'XAI',
    Coze: 'Coze.Color',
    SiliconFlow: 'SiliconCloud.Color',
    MokaAI: 'OpenAI',
    OpenRouter: 'OpenRouter',

    // Image/Video generation
    Midjourney: 'Midjourney',
    MidjourneyPlus: 'Midjourney',
    Kling: 'Kling.Color',
    Jimeng: 'Doubao.Color',
    Vidu: 'OpenAI',
    SunoAPI: 'Suno',

    // Tools & Platforms
    Dify: 'Dify.Color',
    Jina: 'OpenAI',
    FastGPT: 'OpenAI',
    Xinference: 'OpenAI',

    // AI Proxy services
    'AI Proxy': 'OpenAI',
    'AI Proxy Library': 'OpenAI',
    API2GPT: 'OpenAI',
    AIGC2D: 'OpenAI',
    AILS: 'OpenAI',
  }

  return iconMap[typeLabel] || 'OpenAI'
}

// ============================================================================
// Status Utilities
// ============================================================================

/**
 * Get status badge configuration
 */
export function getChannelStatusBadge(status: number) {
  return (
    CHANNEL_STATUS_CONFIG[status as keyof typeof CHANNEL_STATUS_CONFIG] ||
    CHANNEL_STATUS_CONFIG[0]
  )
}

/**
 * Get multi-key status badge configuration
 */
export function getMultiKeyStatusBadge(status: number) {
  return (
    MULTI_KEY_STATUS_CONFIG[status as keyof typeof MULTI_KEY_STATUS_CONFIG] ||
    MULTI_KEY_STATUS_CONFIG[1]
  )
}

/**
 * Check if channel is enabled
 */
export function isChannelEnabled(channel: Channel): boolean {
  return channel.status === 1
}

/**
 * Check if channel is multi-key
 */
export function isMultiKeyChannel(channel: Channel): boolean {
  return channel.channel_info?.is_multi_key || false
}

// ============================================================================
// Key Formatting
// ============================================================================

/**
 * Format channel key for display
 * Masks the key for security, showing only first and last few characters
 */
export function formatChannelKey(
  key: string,
  isMultiKey: boolean = false
): string {
  if (!key) return ''

  if (isMultiKey) {
    const keys = key.split('\n').filter((k) => k.trim())
    return `${keys.length} keys`
  }

  if (key.length <= 16) {
    // For short keys, mask middle part
    return `${key.slice(0, 4)}...${key.slice(-4)}`
  }

  // For longer keys, show more context
  return `${key.slice(0, 8)}...${key.slice(-8)}`
}

/**
 * Format key preview for multi-key display
 */
export function formatKeyPreview(key: string, maxLength: number = 10): string {
  if (!key) return ''
  if (key.length <= maxLength) return key
  return `${key.slice(0, maxLength)}...`
}

/**
 * Count keys in multi-key string
 */
export function countKeys(key: string): number {
  if (!key) return 0
  return key.split('\n').filter((k) => k.trim()).length
}

// ============================================================================
// Model & Group Parsing
// ============================================================================

/**
 * Parse comma-separated models list
 */
export function parseModelsList(models: string): string[] {
  if (!models) return []
  return models
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
}

/**
 * Parse comma-separated groups list
 */
export function parseGroupsList(groups: string): string[] {
  if (!groups) return []
  return groups
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
}

/**
 * Format models array back to string
 */
export function formatModelsString(models: string[]): string {
  return models.join(',')
}

/**
 * Format groups array back to string
 */
export function formatGroupsString(groups: string[]): string {
  return groups.join(',')
}

// ============================================================================
// Settings Parsing
// ============================================================================

/**
 * Parse channel settings JSON
 */
export function parseChannelSettings(
  settingStr: string | null | undefined
): ChannelSettings {
  if (!settingStr) return {}
  try {
    return JSON.parse(settingStr) as ChannelSettings
  } catch {
    return {}
  }
}

/**
 * Parse channel other settings JSON
 */
export function parseChannelOtherSettings(
  settingsStr: string | null | undefined
): ChannelOtherSettings {
  if (!settingsStr || settingsStr === '{}') return {}
  try {
    return JSON.parse(settingsStr) as ChannelOtherSettings
  } catch {
    return {}
  }
}

/**
 * Validate JSON string
 */
export function validateChannelSettings(settings: string): boolean {
  if (!settings || settings.trim() === '') return true
  try {
    JSON.parse(settings)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Balance Formatting
// ============================================================================

/**
 * Format balance with currency symbol
 */
export function formatBalance(
  balance: number,
  currency: string = 'USD'
): string {
  if (balance === 0) return '$0.00'

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return formatter.format(balance)
}

/**
 * Get balance status color
 */
export function getBalanceVariant(
  balance: number
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (balance === 0) return 'neutral'
  if (balance < 1) return 'danger'
  if (balance < 10) return 'warning'
  return 'success'
}

// ============================================================================
// Response Time Utilities
// ============================================================================

/**
 * Format response time in milliseconds to human-readable
 */
export function formatResponseTime(timeMs: number): string {
  if (timeMs === 0) return 'Not tested'
  if (timeMs < 1000) return `${timeMs}ms`
  return `${(timeMs / 1000).toFixed(2)}s`
}

/**
 * Get response time performance rating
 */
export function getResponseTimeConfig(timeMs: number) {
  if (timeMs === 0) return RESPONSE_TIME_CONFIG.UNKNOWN
  if (timeMs <= RESPONSE_TIME_THRESHOLDS.EXCELLENT)
    return RESPONSE_TIME_CONFIG.EXCELLENT
  if (timeMs <= RESPONSE_TIME_THRESHOLDS.GOOD) return RESPONSE_TIME_CONFIG.GOOD
  if (timeMs <= RESPONSE_TIME_THRESHOLDS.FAIR) return RESPONSE_TIME_CONFIG.FAIR
  if (timeMs <= RESPONSE_TIME_THRESHOLDS.POOR) return RESPONSE_TIME_CONFIG.POOR
  return RESPONSE_TIME_CONFIG.POOR
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format Unix timestamp to relative time
 * e.g., "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || timestamp === 0) return 'Never'

  try {
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

/**
 * Format Unix timestamp to date string
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp || timestamp === 0) return 'N/A'

  try {
    return new Date(timestamp * 1000).toLocaleString()
  } catch {
    return 'Invalid date'
  }
}

// ============================================================================
// Quota Formatting
// ============================================================================

/**
 * Format quota in smallest unit to readable format
 * The quota is stored in smallest unit (e.g., 1000000 = $1)
 */
export function formatQuota(quota: number): string {
  const dollars = quota / 500000 // Convert to dollars based on backend logic
  return formatBalance(dollars)
}

// ============================================================================
// Priority & Weight Utilities
// ============================================================================

/**
 * Get priority display value
 */
export function getPriorityDisplay(
  priority: number | null | undefined
): string {
  if (priority === null || priority === undefined) return '0'
  return String(priority)
}

/**
 * Get weight display value
 */
export function getWeightDisplay(weight: number | null | undefined): string {
  if (weight === null || weight === undefined) return '0'
  return String(weight)
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate channel name
 */
export function validateChannelName(name: string): boolean {
  return name.trim().length > 0
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string): boolean {
  return key.trim().length > 0
}

/**
 * Validate models list
 */
export function validateModels(models: string): boolean {
  return parseModelsList(models).length > 0
}

/**
 * Validate groups list
 */
export function validateGroups(groups: string): boolean {
  return parseGroupsList(groups).length > 0
}

/**
 * Check if channel needs attention (low balance, auto-disabled, etc.)
 */
export function channelNeedsAttention(channel: Channel): boolean {
  // Auto-disabled
  if (channel.status === 2) return true

  // Low balance (less than $1)
  if (channel.balance > 0 && channel.balance < 1) return true

  // Multi-key channel with all keys disabled
  if (
    channel.channel_info?.is_multi_key &&
    channel.channel_info.multi_key_status_list &&
    Object.keys(channel.channel_info.multi_key_status_list).length >=
      channel.channel_info.multi_key_size
  ) {
    return true
  }

  return false
}

/**
 * Get attention reason for channel
 */
export function getAttentionReason(channel: Channel): string | null {
  if (channel.status === 2) return 'Auto-disabled'
  if (channel.balance > 0 && channel.balance < 1) return 'Low balance'
  if (
    channel.channel_info?.is_multi_key &&
    channel.channel_info.multi_key_status_list &&
    Object.keys(channel.channel_info.multi_key_status_list).length >=
      channel.channel_info.multi_key_size
  ) {
    return 'All keys disabled'
  }
  return null
}

// ============================================================================
// Tag Aggregation Utilities
// ============================================================================

/**
 * Tag row type (extends Channel with children)
 */
export type TagRow = Channel & {
  children: Channel[]
}

/**
 * Type guard to check whether a row is a tag aggregate row
 */
export function isTagAggregateRow(
  row: Channel | TagRow
): row is TagRow {
  return Array.isArray((row as TagRow).children)
}

/**
 * Aggregate channels by tag for tag mode display
 * Converts flat array into tree structure grouped by tag
 */
export function aggregateChannelsByTag(
  channels: Channel[]
): (Channel | TagRow)[] {
  const tagMap = new Map<string, TagRow>()
  const result: (Channel | TagRow)[] = []

  for (const channel of channels) {
    const tag = channel.tag || ''

    if (!tagMap.has(tag)) {
      // Create tag aggregate row
      const tagRow: TagRow = {
        ...channel,
        key: tag,
        id: tag as any,
        tag: tag,
        name: tag, // Will be prefixed in UI
        type: 0,
        status: undefined as any,
        group: '',
        used_quota: 0,
        response_time: 0,
        priority: -1 as any,
        weight: -1 as any,
        balance: 0,
        test_time: 0,
        created_time: 0,
        balance_updated_time: 0,
        models: '',
        children: [],
      }
      tagMap.set(tag, tagRow)
      result.push(tagRow)
    }

    const tagRow = tagMap.get(tag)!

    // Add to children
    tagRow.children.push(channel)
    const childCount = tagRow.children.length

    // Aggregate used_quota (sum)
    tagRow.used_quota += channel.used_quota

    // Aggregate response_time (average)
    tagRow.response_time =
      (tagRow.response_time * (childCount - 1) + channel.response_time) /
      childCount

    // Aggregate priority (same value or null if different)
    if (tagRow.priority === -1) {
      tagRow.priority = channel.priority
    } else if (tagRow.priority !== channel.priority) {
      tagRow.priority = null as any
    }

    // Aggregate weight (same value or null if different)
    if (tagRow.weight === -1) {
      tagRow.weight = channel.weight
    } else if (tagRow.weight !== channel.weight) {
      tagRow.weight = null as any
    }

    // Aggregate group (concatenate and deduplicate)
    if (tagRow.group === '') {
      tagRow.group = channel.group
    } else {
      const existingGroups = new Set(tagRow.group.split(',').filter(Boolean))
      const newGroups = channel.group.split(',').filter(Boolean)
      newGroups.forEach((g) => {
        if (!existingGroups.has(g)) {
          tagRow.group += ',' + g
        }
      })
    }

    // Aggregate status (enabled if any child is enabled)
    if (channel.status === 1) {
      tagRow.status = 1
    } else if (tagRow.status === undefined) {
      tagRow.status = channel.status
    }
  }

  return result
}
