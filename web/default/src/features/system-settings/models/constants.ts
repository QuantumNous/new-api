export const DEFAULT_ENDPOINT = '/api/pricing'

export const OFFICIAL_CHANNEL_ENDPOINT =
  '/llm-metadata/api/newapi/ratio_config-v1-base.json'

export const OFFICIAL_CHANNEL_BASE_URL = 'https://basellm.github.io'

export const OFFICIAL_CHANNEL_NAME = '官方倍率预设'

export const OFFICIAL_CHANNEL_ID = -100

export const ENDPOINT_OPTIONS = [
  { label: 'pricing', value: '/api/pricing' },
  { label: 'ratio_config', value: '/api/ratio_config' },
  { label: 'custom', value: 'custom' },
] as const

export const RATIO_TYPE_OPTIONS = [
  { label: 'Model Ratio', value: 'model_ratio' },
  { label: 'Completion Ratio', value: 'completion_ratio' },
  { label: 'Cache Ratio', value: 'cache_ratio' },
  { label: 'Cache Create Ratio', value: 'create_cache_ratio' },
  { label: 'Image Ratio', value: 'image_ratio' },
  { label: 'Audio Ratio', value: 'audio_ratio' },
  { label: 'Audio Completion Ratio', value: 'audio_completion_ratio' },
  { label: 'Fixed Price', value: 'model_price' },
  { label: 'Expression Billing', value: 'billing_expr' },
] as const

export const CHANNEL_STATUS_CONFIG = {
  1: { label: 'Enabled', variant: 'success' as const },
  2: { label: 'Disabled', variant: 'danger' as const },
  3: { label: 'Auto-Disabled', variant: 'warning' as const },
} as const
