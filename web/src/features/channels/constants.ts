import i18n from '@/i18n/config'

// ============================================================================
// Channel Types (from constant/channel.go)
// ============================================================================

export const CHANNEL_TYPES = {
  0: i18n.t('Unknown'),
  1: i18n.t('OpenAI'),
  2: i18n.t('Midjourney'),
  3: i18n.t('Azure'),
  4: i18n.t('Ollama'),
  5: i18n.t('MidjourneyPlus'),
  6: i18n.t('OpenAIMax'),
  7: i18n.t('OhMyGPT'),
  8: i18n.t('Custom'),
  9: i18n.t('AILS'),
  10: i18n.t('AI Proxy'),
  11: i18n.t('PaLM'),
  12: i18n.t('API2GPT'),
  13: i18n.t('AIGC2D'),
  14: i18n.t('Anthropic'),
  15: i18n.t('Baidu'),
  16: i18n.t('Zhipu'),
  17: i18n.t('Ali'),
  18: i18n.t('Xunfei'),
  19: i18n.t('360'),
  20: i18n.t('OpenRouter'),
  21: i18n.t('AI Proxy Library'),
  22: i18n.t('FastGPT'),
  23: i18n.t('Tencent'),
  24: i18n.t('Gemini'),
  25: i18n.t('Moonshot'),
  26: i18n.t('Zhipu V4'),
  27: i18n.t('Perplexity'),
  31: i18n.t('LingYiWanWu'),
  33: i18n.t('AWS'),
  34: i18n.t('Cohere'),
  35: i18n.t('MiniMax'),
  36: i18n.t('SunoAPI'),
  37: i18n.t('Dify'),
  38: i18n.t('Jina'),
  39: i18n.t('Cloudflare'),
  40: i18n.t('SiliconFlow'),
  41: i18n.t('Vertex AI'),
  42: i18n.t('Mistral'),
  43: i18n.t('DeepSeek'),
  44: i18n.t('MokaAI'),
  45: i18n.t('VolcEngine'),
  46: i18n.t('Baidu V2'),
  47: i18n.t('Xinference'),
  48: i18n.t('xAI'),
  49: i18n.t('Coze'),
  50: i18n.t('Kling'),
  51: i18n.t('Jimeng'),
  52: i18n.t('Vidu'),
  53: i18n.t('Submodel'),
  54: i18n.t('DoubaoVideo'),
  55: i18n.t('Sora'),
  56: i18n.t('Replicate'),
} as const

export const CHANNEL_TYPE_OPTIONS = Object.entries(CHANNEL_TYPES)
  .filter(([value]) => {
    const num = Number(value)
    return num !== 0 // Exclude Unknown
  })
  .map(([value, label]) => ({
    value: Number(value),
    label,
  }))

// ============================================================================
// Channel Status
// ============================================================================

export const CHANNEL_STATUS = {
  UNKNOWN: 0,
  ENABLED: 1,
  MANUAL_DISABLED: 2,
  AUTO_DISABLED: 3,
} as const

export const CHANNEL_STATUS_LABELS = {
  [CHANNEL_STATUS.UNKNOWN]: i18n.t('Unknown'),
  [CHANNEL_STATUS.ENABLED]: i18n.t('Enabled'),
  [CHANNEL_STATUS.MANUAL_DISABLED]: i18n.t('Disabled'),
  [CHANNEL_STATUS.AUTO_DISABLED]: i18n.t('Auto Disabled'),
} as const

export const CHANNEL_STATUS_OPTIONS = [
  { value: 'all', label: i18n.t('All Status') },
  { value: 'enabled', label: i18n.t('Enabled') },
  { value: 'disabled', label: i18n.t('Disabled') },
] as const

// Status badge configurations
export const CHANNEL_STATUS_CONFIG = {
  [CHANNEL_STATUS.UNKNOWN]: {
    variant: 'neutral' as const,
    label: i18n.t('Unknown'),
    showDot: true,
  },
  [CHANNEL_STATUS.ENABLED]: {
    variant: 'success' as const,
    label: i18n.t('Enabled'),
    showDot: true,
  },
  [CHANNEL_STATUS.MANUAL_DISABLED]: {
    variant: 'neutral' as const,
    label: i18n.t('Disabled'),
    showDot: true,
  },
  [CHANNEL_STATUS.AUTO_DISABLED]: {
    variant: 'danger' as const,
    label: i18n.t('Auto Disabled'),
    showDot: true,
  },
}

// ============================================================================
// Multi-Key Status
// ============================================================================

export const MULTI_KEY_STATUS = {
  ENABLED: 1,
  MANUAL_DISABLED: 2,
  AUTO_DISABLED: 3,
} as const

export const MULTI_KEY_STATUS_LABELS = {
  [MULTI_KEY_STATUS.ENABLED]: i18n.t('Enabled'),
  [MULTI_KEY_STATUS.MANUAL_DISABLED]: i18n.t('Manual Disabled'),
  [MULTI_KEY_STATUS.AUTO_DISABLED]: i18n.t('Auto Disabled'),
} as const

export const MULTI_KEY_STATUS_CONFIG = {
  [MULTI_KEY_STATUS.ENABLED]: {
    variant: 'success' as const,
    label: i18n.t('Enabled'),
  },
  [MULTI_KEY_STATUS.MANUAL_DISABLED]: {
    variant: 'neutral' as const,
    label: i18n.t('Manual Disabled'),
  },
  [MULTI_KEY_STATUS.AUTO_DISABLED]: {
    variant: 'danger' as const,
    label: i18n.t('Auto Disabled'),
  },
}

// ============================================================================
// Multi-Key Modes
// ============================================================================

export const MULTI_KEY_MODES = [
  { value: 'random', label: i18n.t('Random') },
  { value: 'polling', label: i18n.t('Polling') },
] as const

export const ADD_MODE_OPTIONS = [
  { value: 'single', label: i18n.t('Single Key') },
  { value: 'batch', label: i18n.t('Batch Add (one key per line)') },
  {
    value: 'multi_to_single',
    label: i18n.t('Multi-Key Mode (multiple keys, one channel)'),
  },
] as const

// ============================================================================
// Multi-Key Management
// ============================================================================

export const MULTI_KEY_FILTER_OPTIONS = [
  { value: 'all', label: i18n.t('All Status') },
  { value: '1', label: i18n.t('Enabled') },
  { value: '2', label: i18n.t('Manual Disabled') },
  { value: '3', label: i18n.t('Auto Disabled') },
] as const

export const MULTI_KEY_CONFIRM_MESSAGES = {
  DELETE: i18n.t(
    'Are you sure you want to delete this key? This action cannot be undone.'
  ),
  ENABLE: i18n.t('Enable this key?'),
  DISABLE: i18n.t('Disable this key?'),
  ENABLE_ALL: i18n.t('Are you sure you want to enable all keys?'),
  DISABLE_ALL: i18n.t('Are you sure you want to disable all enabled keys?'),
  DELETE_DISABLED: i18n.t(
    'Are you sure you want to delete all auto-disabled keys? This action cannot be undone.'
  ),
} as const

// ============================================================================
// Auto Ban Options
// ============================================================================

export const AUTO_BAN_OPTIONS = [
  { value: 1, label: i18n.t('Enabled') },
  { value: 0, label: i18n.t('Disabled') },
] as const

// ============================================================================
// Form Messages
// ============================================================================

export const ERROR_MESSAGES = {
  REQUIRED_NAME: i18n.t('Channel name is required'),
  REQUIRED_TYPE: i18n.t('Channel type is required'),
  REQUIRED_KEY: i18n.t('API key is required'),
  REQUIRED_MODELS: i18n.t('Models are required'),
  REQUIRED_GROUP: i18n.t('Group is required'),
  INVALID_JSON: i18n.t('Invalid JSON format'),
  INVALID_MODEL_MAPPING: i18n.t('Invalid model mapping format'),
  CREATE_FAILED: i18n.t('Failed to create channel'),
  UPDATE_FAILED: i18n.t('Failed to update channel'),
  DELETE_FAILED: i18n.t('Failed to delete channel'),
  TEST_FAILED: i18n.t('Failed to test channel'),
  BALANCE_QUERY_FAILED: i18n.t('Failed to query balance'),
  FETCH_MODELS_FAILED: i18n.t('Failed to fetch models'),
} as const

export const SUCCESS_MESSAGES = {
  CREATED: i18n.t('Channel created successfully'),
  UPDATED: i18n.t('Channel updated successfully'),
  DELETED: i18n.t('Channel deleted successfully'),
  ENABLED: i18n.t('Channel enabled successfully'),
  DISABLED: i18n.t('Channel disabled successfully'),
  TESTED: i18n.t('Channel test completed'),
  BALANCE_QUERIED: i18n.t('Balance queried successfully'),
  MODELS_FETCHED: i18n.t('Models fetched successfully'),
  COPIED: i18n.t('Channel copied successfully'),
  TAG_SET: i18n.t('Tag set successfully'),
  BATCH_DELETED: i18n.t('Channels deleted successfully'),
} as const

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_PAGE_SIZE = 20

export const DEFAULT_CHANNEL_VALUES = {
  name: '',
  type: 0,
  base_url: '',
  key: '',
  models: '',
  group: 'default',
  status: CHANNEL_STATUS.ENABLED,
  priority: 0,
  weight: 0,
  auto_ban: 1,
  remark: '',
} as const

// ============================================================================
// Table Configuration
// ============================================================================

export const CHANNELS_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ============================================================================
// Sort Options
// ============================================================================

export const SORT_OPTIONS = [
  { value: 'priority', label: i18n.t('Priority (Default)') },
  { value: 'id', label: i18n.t('ID') },
  { value: 'name', label: i18n.t('Name') },
  { value: 'balance', label: i18n.t('Balance') },
  { value: 'response_time', label: i18n.t('Response Time') },
] as const

// ============================================================================
// Balance Display
// ============================================================================

export const BALANCE_THRESHOLDS = {
  LOW: 1,
  MEDIUM: 10,
  HIGH: 100,
} as const

// ============================================================================
// Response Time Thresholds (in ms)
// ============================================================================

export const RESPONSE_TIME_THRESHOLDS = {
  EXCELLENT: 500,
  GOOD: 1000,
  FAIR: 2000,
  POOR: 5000,
} as const

export const RESPONSE_TIME_CONFIG = {
  EXCELLENT: { variant: 'success' as const, label: i18n.t('Excellent') },
  GOOD: { variant: 'info' as const, label: i18n.t('Good') },
  FAIR: { variant: 'warning' as const, label: i18n.t('Fair') },
  POOR: { variant: 'danger' as const, label: i18n.t('Poor') },
  UNKNOWN: { variant: 'neutral' as const, label: i18n.t('Not tested') },
} as const

// ============================================================================
// Field Hints and Placeholders
// ============================================================================

export const FIELD_PLACEHOLDERS = {
  NAME: i18n.t('e.g., OpenAI GPT-4 Production'),
  BASE_URL: i18n.t('Leave empty to use default'),
  KEY: i18n.t('API Key (one per line for batch mode)'),
  MODELS: i18n.t('Comma-separated model names, e.g., gpt-4,gpt-3.5-turbo'),
  GROUP: i18n.t('Please Select user groups that can access this channel.'),
  MODEL_MAPPING: '{"request_model": "actual_model"}',
  TEST_MODEL: i18n.t('Model to use for testing'),
  TAG: i18n.t('Optional tag for grouping channels'),
  REMARK: i18n.t('Optional notes about this channel'),
  PARAM_OVERRIDE: '{"temperature": 0.7}',
  HEADER_OVERRIDE: '{"X-Custom-Header": "value"}',
  STATUS_CODE_MAPPING: '{"400": "500"}',
} as const

export const FIELD_DESCRIPTIONS = {
  NAME: i18n.t('Friendly name to identify this channel'),
  TYPE: i18n.t('Provider type (OpenAI, Anthropic, etc.)'),
  BASE_URL: i18n.t('Custom API base URL. Leave empty to use provider default.'),
  KEY: i18n.t('API key from the provider'),
  MODELS: i18n.t(
    'List of models supported by this channel. Use comma to separate multiple models.'
  ),
  GROUP: i18n.t('User groups that can access this channel. '),
  MODEL_MAPPING: i18n.t(
    'Map request model names to actual provider model names (JSON format)'
  ),
  PRIORITY: i18n.t('Higher priority channels are selected first'),
  WEIGHT: i18n.t('Used for load balancing. Higher weight = more requests'),
  TEST_MODEL: i18n.t('Model to use when testing channel connectivity'),
  AUTO_BAN: i18n.t('Automatically disable channel on repeated failures'),
  STATUS_CODE_MAPPING: i18n.t('Map response status codes (JSON format)'),
  TAG: i18n.t('Group channels by tag for batch operations'),
  REMARK: i18n.t('Internal notes (not shown to users)'),
  SETTING: i18n.t('Channel-specific settings (JSON format)'),
  PARAM_OVERRIDE: i18n.t('Override request parameters (JSON format)'),
  HEADER_OVERRIDE: i18n.t('Override request headers (JSON format)'),
  MULTI_KEY_MODE: i18n.t('How to select keys: random or sequential polling'),
  BATCH_ADD: i18n.t('Create multiple channels from multiple keys'),
  OPENAI_ORG: i18n.t('OpenAI Organization ID (optional)'),
} as const

// ============================================================================
// Channel Type Specific Configurations
// ============================================================================

// Channel types that support fetching models from upstream
export const MODEL_FETCHABLE_TYPES = new Set([
  1, // OpenAI
  4, // Ollama
  14, // Anthropic
  17, // Ali
  20, // OpenRouter
  23, // Tencent
  24, // Gemini
  25, // Moonshot
  26, // Zhipu V4
  31, // LingYiWanWu
  34, // Cohere
  35, // MiniMax
  40, // SiliconFlow
  42, // Mistral
  43, // DeepSeek
  47, // Xinference
  48, // xAI
])

// Channel type specific key format prompts
export const TYPE_TO_KEY_PROMPT: Record<number, string> = {
  15: i18n.t('Format: APIKey|SecretKey'),
  18: i18n.t('Format: APPID|APISecret|APIKey'),
  22: i18n.t(
    'Format: APIKey-AppId, e.g., fastgpt-0sp2gtvfdgyi4k30jwlgwf1i-64f335d84283f05518e9e041'
  ),
  23: i18n.t('Format: AppId|SecretId|SecretKey'),
  33: i18n.t('Format: Ak|Sk|Region'),
  50: i18n.t(
    'Format: AccessKey|SecretKey (or just ApiKey if upstream is New API)'
  ),
  51: i18n.t('Format: Access Key ID|Secret Access Key'),
}

// Channel types with special warnings
export const CHANNEL_TYPE_WARNINGS: Record<number, string> = {
  3: i18n.t(
    'For channels added after May 10, 2025, no need to remove "." from model names during deployment'
  ),
  8: i18n.t(
    'If connecting to upstream One API or New API relay projects, use OpenAI type instead unless you know what you are doing'
  ),
  37: i18n.t(
    'Dify channels only support chatflow and agent, and agent does not support images'
  ),
}
