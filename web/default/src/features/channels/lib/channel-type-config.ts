import { CHANNEL_TYPES } from '../constants'

// ============================================================================
// Channel Type Configuration
// ============================================================================

export interface ChannelTypeConfig {
  id: number
  name: string
  icon: string
  defaultBaseUrl?: string
  requiresOrganization?: boolean
  requiresRegion?: boolean
  supportedModels?: string[]
  hints?: {
    baseUrl?: string
    key?: string
    models?: string
    other?: string
  }
  validation?: {
    keyFormat?: RegExp
    keyMinLength?: number
  }
}

/**
 * Default base URLs indexed by channel type ID.
 * Matches backend constant/channel.go ChannelBaseURLs array.
 */
export const CHANNEL_DEFAULT_BASE_URLS: Record<number, string> = {
  1:  'https://api.openai.com',
  2:  'https://oa.api2d.net',
  4:  'http://localhost:11434',
  5:  'https://api.openai-sb.com',
  6:  'https://api.openaimax.com',
  7:  'https://api.ohmygpt.com',
  9:  'https://api.caipacity.com',
  10: 'https://api.aiproxy.io',
  12: 'https://api.api2gpt.com',
  13: 'https://api.aigc2d.com',
  14: 'https://api.anthropic.com',
  15: 'https://aip.baidubce.com',
  16: 'https://open.bigmodel.cn',
  17: 'https://dashscope.aliyuncs.com',
  19: 'https://api.360.cn',
  20: 'https://openrouter.ai/api',
  21: 'https://api.aiproxy.io',
  22: 'https://fastgpt.run/api/openapi',
  23: 'https://hunyuan.tencentcloudapi.com',
  24: 'https://generativelanguage.googleapis.com',
  25: 'https://api.moonshot.cn',
  26: 'https://open.bigmodel.cn',
  27: 'https://api.perplexity.ai',
  31: 'https://api.lingyiwanwu.com',
  34: 'https://api.cohere.ai',
  35: 'https://api.minimax.chat',
  37: 'https://api.dify.ai',
  38: 'https://api.jina.ai',
  39: 'https://api.cloudflare.com',
  40: 'https://api.siliconflow.cn',
  42: 'https://api.mistral.ai',
  43: 'https://api.deepseek.com',
  44: 'https://api.moka.ai',
  45: 'https://ark.cn-beijing.volces.com',
  46: 'https://qianfan.baidubce.com',
  48: 'https://api.x.ai',
  49: 'https://api.coze.cn',
  50: 'https://api.klingai.com',
  51: 'https://visual.volcengineapi.com',
  52: 'https://api.vidu.cn',
  53: 'https://llm.submodel.ai',
  54: 'https://ark.cn-beijing.volces.com',
  55: 'https://api.openai.com',
  56: 'https://api.replicate.com',
  57: 'https://chatgpt.com',
}

/**
 * Configuration for each channel type
 */
export const CHANNEL_TYPE_CONFIGS: Record<number, ChannelTypeConfig> = {
  1: {
    id: 1,
    name: CHANNEL_TYPES[1],
    icon: 'openai',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[1],
    requiresOrganization: true,
    hints: {
      key: 'Format: sk-...',
      models: 'gpt-4,gpt-4-turbo,gpt-3.5-turbo',
    },
    validation: {
      keyFormat: /^sk-/,
      keyMinLength: 20,
    },
  },
  3: {
    id: 3,
    name: CHANNEL_TYPES[3],
    icon: 'azure',
    requiresRegion: true,
    hints: {
      baseUrl: 'Azure OpenAI Endpoint',
      key: 'Azure API Key',
      models: 'Deployment names',
    },
  },
  14: {
    id: 14,
    name: CHANNEL_TYPES[14],
    icon: 'anthropic',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[14],
    hints: {
      key: 'Format: sk-ant-...',
      models: 'claude-3-opus,claude-3-sonnet,claude-3-haiku',
    },
  },
  16: {
    id: 16,
    name: CHANNEL_TYPES[16],
    icon: 'zhipu',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[16],
    hints: { key: 'Zhipu API Key' },
  },
  17: {
    id: 17,
    name: CHANNEL_TYPES[17],
    icon: 'ali',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[17],
    hints: { key: 'DashScope API Key' },
  },
  20: {
    id: 20,
    name: CHANNEL_TYPES[20],
    icon: 'openrouter',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[20],
    hints: { key: 'OpenRouter API Key' },
  },
  23: {
    id: 23,
    name: CHANNEL_TYPES[23],
    icon: 'tencent',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[23],
    hints: { key: 'Format: AppId|SecretId|SecretKey' },
  },
  24: {
    id: 24,
    name: CHANNEL_TYPES[24],
    icon: 'google',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[24],
    hints: { key: 'Google API Key' },
  },
  25: {
    id: 25,
    name: CHANNEL_TYPES[25],
    icon: 'moonshot',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[25],
    hints: { key: 'Moonshot API Key' },
  },
  26: {
    id: 26,
    name: CHANNEL_TYPES[26],
    icon: 'zhipu',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[26],
    hints: { key: 'Zhipu V4 API Key' },
  },
  27: {
    id: 27,
    name: CHANNEL_TYPES[27],
    icon: 'perplexity',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[27],
    hints: { key: 'Perplexity API Key' },
  },
  31: {
    id: 31,
    name: CHANNEL_TYPES[31],
    icon: 'lingyiwanwu',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[31],
    hints: { key: 'LingYi API Key' },
  },
  34: {
    id: 34,
    name: CHANNEL_TYPES[34],
    icon: 'cohere',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[34],
    hints: { key: 'Cohere API Key' },
  },
  35: {
    id: 35,
    name: CHANNEL_TYPES[35],
    icon: 'minimax',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[35],
    hints: { key: 'MiniMax API Key' },
  },
  37: {
    id: 37,
    name: CHANNEL_TYPES[37],
    icon: 'dify',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[37],
    hints: { key: 'Dify API Key' },
  },
  40: {
    id: 40,
    name: CHANNEL_TYPES[40],
    icon: 'siliconflow',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[40],
    hints: { key: 'SiliconFlow API Key' },
  },
  41: {
    id: 41,
    name: CHANNEL_TYPES[41],
    icon: 'google',
    requiresRegion: true,
    hints: {
      key: 'Service account JSON or API key',
      other: 'Region config: {"default": "us-central1"}',
    },
  },
  42: {
    id: 42,
    name: CHANNEL_TYPES[42],
    icon: 'mistral',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[42],
    hints: { key: 'Mistral API Key' },
  },
  43: {
    id: 43,
    name: CHANNEL_TYPES[43],
    icon: 'deepseek',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[43],
    hints: { key: 'DeepSeek API Key', models: 'deepseek-chat,deepseek-reasoner' },
  },
  45: {
    id: 45,
    name: CHANNEL_TYPES[45],
    icon: 'volcengine',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[45],
    hints: { key: 'VolcEngine API Key' },
  },
  46: {
    id: 46,
    name: CHANNEL_TYPES[46],
    icon: 'baidu',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[46],
    hints: { key: 'Baidu V2 API Key' },
  },
  48: {
    id: 48,
    name: CHANNEL_TYPES[48],
    icon: 'xai',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[48],
    hints: { key: 'xAI API Key', models: 'grok-beta,grok-2' },
  },
  49: {
    id: 49,
    name: CHANNEL_TYPES[49],
    icon: 'coze',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[49],
    hints: { key: 'Coze API Key' },
  },
  53: {
    id: 53,
    name: CHANNEL_TYPES[53],
    icon: 'submodel',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[53],
    hints: { key: 'Submodel API Key' },
  },
  56: {
    id: 56,
    name: CHANNEL_TYPES[56],
    icon: 'replicate',
    defaultBaseUrl: CHANNEL_DEFAULT_BASE_URLS[56],
    hints: { key: 'Replicate API Token' },
  },
}

/**
 * Get configuration for a channel type
 */
export function getChannelTypeConfig(type: number): ChannelTypeConfig {
  return (
    CHANNEL_TYPE_CONFIGS[type] || {
      id: type,
      name: CHANNEL_TYPES[type as keyof typeof CHANNEL_TYPES] || 'Unknown',
      icon: 'openai',
    }
  )
}

/**
 * Check if channel type requires organization field
 */
export function requiresOrganization(type: number): boolean {
  return CHANNEL_TYPE_CONFIGS[type]?.requiresOrganization || false
}

/**
 * Check if channel type requires region configuration
 */
export function requiresRegion(type: number): boolean {
  return CHANNEL_TYPE_CONFIGS[type]?.requiresRegion || false
}

/**
 * Get default base URL for channel type
 */
export function getDefaultBaseUrl(type: number): string {
  return CHANNEL_TYPE_CONFIGS[type]?.defaultBaseUrl || ''
}

/**
 * Get hints for channel type
 */
export function getChannelTypeHints(type: number) {
  return CHANNEL_TYPE_CONFIGS[type]?.hints || {}
}

/**
 * Validate API key format for channel type
 */
export function validateKeyFormat(type: number, key: string): boolean {
  const config = CHANNEL_TYPE_CONFIGS[type]
  if (!config?.validation) return true

  const { keyFormat, keyMinLength } = config.validation

  if (keyMinLength && key.length < keyMinLength) {
    return false
  }

  if (keyFormat && !keyFormat.test(key)) {
    return false
  }

  return true
}
