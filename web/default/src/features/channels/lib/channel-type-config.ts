/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  CHANNEL_TYPES,
  CHANNEL_TYPE_SUB2API,
  CHANNEL_TYPE_NEWAPI,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
} from '../constants'

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
 * Configuration for each channel type
 */
export const CHANNEL_TYPE_CONFIGS: Record<number, ChannelTypeConfig> = {
  1: {
    id: 1,
    name: CHANNEL_TYPES[1],
    icon: 'openai',
    defaultBaseUrl: 'https://api.openai.com',
    requiresOrganization: true,
    hints: {
      baseUrl: 'Default: https://api.openai.com',
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
    defaultBaseUrl: 'https://api.anthropic.com',
    hints: {
      key: 'Format: sk-ant-...',
      models: 'claude-3-opus,claude-3-sonnet,claude-3-haiku',
    },
  },
  24: {
    id: 24,
    name: CHANNEL_TYPES[24],
    icon: 'google',
    hints: {
      key: 'Google API Key',
      models: 'gemini-pro,gemini-pro-vision',
    },
  },
  41: {
    id: 41,
    name: CHANNEL_TYPES[41],
    icon: 'google',
    requiresRegion: true,
    hints: {
      key: 'Service account JSON or API key',
      models: 'gemini-pro,gemini-1.5-pro',
      other: 'Region config: {"default": "us-central1"}',
    },
  },
  43: {
    id: 43,
    name: CHANNEL_TYPES[43],
    icon: 'deepseek',
    defaultBaseUrl: 'https://api.deepseek.com',
    hints: {
      key: 'DeepSeek API Key',
      models: 'deepseek-chat,deepseek-coder',
    },
  },
  68: {
    id: 68,
    name: CHANNEL_TYPES[68],
    icon: 'Cerebras.Color',
    defaultBaseUrl: 'https://api.cerebras.ai',
    hints: {
      baseUrl: 'Default: https://api.cerebras.ai',
      key: 'Cerebras API Key',
      models: 'gpt-oss-120b,qwen-3.8-27b,zai-glm-4.7,gemma-4-31b',
      other:
        'OpenAI-compatible Chat Completions with Cerebras-specific parameters such as clear_thinking, prompt_cache_key and reasoning_format',
    },
  },
  74: {
    id: 74,
    name: CHANNEL_TYPES[74],
    icon: 'Groq.Mono',
    defaultBaseUrl: 'https://api.groq.com/openai',
    hints: {
      baseUrl: 'Default: https://api.groq.com/openai',
      key: 'Groq API Key',
      models:
        'llama-3.3-70b-versatile,llama-3.1-8b-instant,openai/gpt-oss-120b,openai/gpt-oss-20b',
      other:
        'OpenAI-compatible Chat/Responses/Audio endpoints with Groq-specific parameters such as reasoning_format passed through',
    },
  },
  75: {
    id: 75,
    name: CHANNEL_TYPES[75],
    icon: 'Stepfun',
    defaultBaseUrl: 'https://api.stepfun.com',
    hints: {
      baseUrl:
        'Default: https://api.stepfun.com (or the stepfun / stepfun-intl / stepfun-step-plan / stepfun-intl-step-plan alias)',
      key: 'StepFun API Key',
      models:
        'step-3.7-flash,step-3.5-flash,step-router-v1,stepaudio-2.5-tts,stepaudio-2.5-asr,stepaudio-3-music-preview',
      other:
        'Chat Completions, Anthropic Messages and OpenAI Responses are passed through natively. Native audio, music, voice and file endpoints are forwarded 1:1; add the stepfun-native model for endpoints that carry no model field. Music/generate/files are open-platform only.',
    },
  },
  76: {
    id: 76,
    name: CHANNEL_TYPES[76],
    icon: 'TypeSafe',
    defaultBaseUrl: 'https://api.typesafe.ai',
    hints: {
      baseUrl: 'Default: https://api.typesafe.ai',
      key: 'TypeSafe API Key',
      models: 'jev-latest,jev-preview,jev-1.13.0',
      other:
        'POST /v1/systemone is forwarded 1:1 to the upstream and responses are passed through as-is; requests to other endpoints are rejected locally. No streaming support.',
    },
  },
  70: {
    id: 70,
    name: CHANNEL_TYPES[70],
    icon: 'Mistral',
    defaultBaseUrl: 'https://console.mistral.ai',
  },
  69: {
    id: 69,
    name: CHANNEL_TYPES[69],
    icon: 'https://avatars.githubusercontent.com/u/282503705?s=200&v=4',
    defaultBaseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com',
    hints: {
      baseUrl: 'Default: https://token-plan.cn-beijing.maas.aliyuncs.com',
      key: 'Enter sk-sp- API key',
      other:
        'Native OpenAI Chat, Responses, and Anthropic Messages routing for Token Plan Personal',
    },
  },
  20: {
    id: 20,
    name: CHANNEL_TYPES[20],
    icon: 'openrouter',
    defaultBaseUrl: 'https://openrouter.ai/api',
    hints: {
      key: 'OpenRouter API Key',
      models: 'Use model IDs from OpenRouter',
    },
  },
  56: {
    id: 56,
    name: CHANNEL_TYPES[56],
    icon: 'replicate',
    defaultBaseUrl: 'https://api.replicate.com',
    hints: {
      key: 'Replicate API Token',
      models: 'Replicate model IDs',
      baseUrl: 'Default: https://api.replicate.com',
    },
  },
  62: {
    id: 62,
    name: CHANNEL_TYPES[62],
    icon: 'XiaomiMiMo',
    defaultBaseUrl: 'https://api.xiaomimimo.com',
    hints: {
      baseUrl: 'Default: https://api.xiaomimimo.com',
      key: 'Xiaomi MiMo API Key',
      models: 'mimo-v2.5-pro,mimo-v2.5,mimo-v2-pro,mimo-v2-omni,mimo-v2-flash',
    },
  },
  64: {
    id: 64,
    name: CHANNEL_TYPES[64],
    icon: 'ZenMux',
    defaultBaseUrl: 'https://zenmux.ai',
    hints: {
      baseUrl: 'Default: https://zenmux.ai',
      key: 'ZenMux API Key',
      models: 'openai/gpt-4o,anthropic/claude-sonnet-4.5,google/gemini-2.5-pro',
      other:
        'Supports OpenAI Chat/Responses, Anthropic Messages, and Vertex AI GenerateContent endpoints',
    },
  },
  65: {
    id: 65,
    name: CHANNEL_TYPES[65],
    icon: 'OpenCode',
    defaultBaseUrl: 'opencode-zen',
    hints: {
      baseUrl: 'Default: OpenCode Zen (opencode-zen)',
      key: 'OpenCode Zen API Key',
      models: 'gpt-5.5,claude-sonnet-4-6,gemini-3-flash,glm-5.1',
      other:
        'OpenCode adds CLI-compatible headers automatically. Zen JEV models use /v1/systemone without streaming.',
    },
  },
  66: {
    id: 66,
    name: CHANNEL_TYPES[66],
    icon: 'GiteeAI',
    defaultBaseUrl: 'https://api.moark.com',
    hints: {
      baseUrl: 'Default: https://api.moark.com',
      key: 'Moark Access Token',
      models: 'DeepSeek-V3,moark-text-moderation,FLUX.1-dev',
      other:
        'Supports OpenAI Chat/Responses, Anthropic Messages, Moderations, and native /v1/async task endpoints',
    },
  },
  67: {
    id: 67,
    name: CHANNEL_TYPES[67],
    icon: 'openai',
    hints: {
      baseUrl: 'Required when advanced route upstream_path is relative',
      key: 'Used by route auth templates as {api_key}',
      models: 'Models routed by this custom channel',
      other:
        'Configure settings.advanced_custom.advanced_routes to map incoming paths, upstream paths, auth, and converters',
    },
  },
  72: {
    id: 72,
    name: CHANNEL_TYPES[72],
    icon: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    hints: {
      baseUrl: 'Default: https://generativelanguage.googleapis.com',
      key: 'Google AI Studio API Key (x-goog-api-key)',
      models:
        'gemini-3.1-flash-lite,deep-research-preview-04-2026,antigravity-preview-05-2026',
      other:
        'Interactions API only: create/get/cancel/delete with server-side state, agents (deep-research, antigravity) and step-based tools; chat/messages/responses inbound converted to interactions',
    },
  },
  71: {
    id: 71,
    name: CHANNEL_TYPES[71],
    icon: 'https://console.gmicloud.ai/favicon.ico',
    defaultBaseUrl: 'https://api.gmi-serving.com',
    hints: {
      baseUrl:
        'Default: https://api.gmi-serving.com (LLM); audio models always use console.gmicloud.ai',
      key: 'GMI Cloud API Key',
      models:
        'MiniMaxAI/MiniMax-M2.7,minimax-tts-speech-2.8-turbo,minimax-music-3.0',
      other:
        'Supports OpenAI Chat/Responses, Anthropic Messages, and GMI requestqueue audio models (TTS, voice clone, music)',
    },
  },
  73: {
    id: 73,
    name: CHANNEL_TYPES[73],
    icon: 'https://github.com/router-for-me.png',
    hints: {
      baseUrl: 'Your CLIProxyAPI instance address, e.g. http://localhost:8317',
      key: 'API key from CLIProxyAPI config (api-keys)',
      models: 'gpt-5.6,claude-opus-4-8,gemini-3.1-pro',
      other:
        'Native passthrough for OpenAI / OpenAI Responses / Anthropic Messages / Gemini / Gemini Interactions endpoints',
    },
  },
  [CHANNEL_TYPE_SUB2API]: {
    id: CHANNEL_TYPE_SUB2API,
    name: CHANNEL_TYPES[CHANNEL_TYPE_SUB2API],
    icon: 'Sub2API',
    hints: {
      baseUrl: 'Sub2API gateway base URL',
      key: 'Sub2API API Key',
      models: 'Models fetched from upstream /v1/models',
    },
  },
  [CHANNEL_TYPE_NEWAPI]: {
    id: CHANNEL_TYPE_NEWAPI,
    name: CHANNEL_TYPES[CHANNEL_TYPE_NEWAPI],
    icon: 'NewAPI',
    hints: {
      baseUrl: 'Base URL is required for this channel type',
      key: 'Enter API key for this channel',
      models: 'Models',
    },
  },
  [CHANNEL_TYPE_VLLM]: {
    id: CHANNEL_TYPE_VLLM,
    name: CHANNEL_TYPES[CHANNEL_TYPE_VLLM],
    icon: 'Vllm',
    defaultBaseUrl: 'http://localhost:8000',
    hints: {
      baseUrl: 'vLLM server address, without /v1',
      key: 'vLLM API key, or EMPTY if authentication is disabled',
      models: 'Models fetched from upstream /v1/models',
    },
  },
  [CHANNEL_TYPE_SGLANG]: {
    id: CHANNEL_TYPE_SGLANG,
    name: CHANNEL_TYPES[CHANNEL_TYPE_SGLANG],
    icon: 'SGLang',
    defaultBaseUrl: 'http://localhost:30000',
    hints: {
      baseUrl: 'SGLang server address, without /v1',
      key: 'SGLang API key, or EMPTY if authentication is disabled',
      models: 'Models fetched from upstream /v1/models',
    },
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
