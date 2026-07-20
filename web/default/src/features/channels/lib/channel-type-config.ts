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
  58: {
    id: 58,
    name: CHANNEL_TYPES[58],
    icon: 'openai',
    defaultBaseUrl: 'https://saast.fuwenhao.com',
    hints: {
      key: 'Format: sk-... (Bearer token)',
      models: 'grok-video-3 (map to upstream req_key)',
      baseUrl: 'Default: https://saast.fuwenhao.com (do not include /open/v1/createtask)',
      other: 'Model mapping: user model → upstream req_key (e.g. newapi_grok-video-3-10s_to_video)',
    },
  },
  59: {
    id: 59,
    name: CHANNEL_TYPES[59],
    icon: 'openai',
    defaultBaseUrl: 'https://api.apimart.ai',
    hints: {
      key: 'Format: sk-... (Bearer token)',
      models: 'grok-imagine-1.0-video-apimart',
      baseUrl: 'Default: https://api.apimart.ai',
      other: 'Async video: POST /v1/videos/generations, poll GET /v1/tasks/{id}',
    },
  },
  60: {
    id: 60,
    name: CHANNEL_TYPES[60],
    icon: 'openai',
    defaultBaseUrl: 'https://apihub.agnes-ai.com',
    hints: {
      key: 'Bearer token (Agnes API Key)',
      models: 'agnes-2.0-flash,agnes-image-2.1-flash,agnes-video-v2.0',
      baseUrl: 'Default: https://apihub.agnes-ai.com',
      other: 'Text: /v1/chat/completions; Image: /v1/images/generations; Video: POST /v1/videos + GET /v1/videos/{task_id}',
    },
  },
  61: {
    id: 61,
    name: CHANNEL_TYPES[61],
    icon: 'openai',
    defaultBaseUrl: 'https://996k.cn/v1',
    hints: {
      key: 'Bearer token',
      models: 'Seedance-2.0, Seedance 2.0, vyro-seedance-2-fast（不稳定·不推荐）',
      baseUrl: 'Default: https://996k.cn/v1',
      other: 'Video only: POST /videos + GET /videos/{id}. Recommended: Seedance-2.0 JSON (reference_images as URL array, generate_audio). Legacy vyro-seedance-2-fast multipart is unstable and not recommended.',
    },
  },
  62: {
    id: 62,
    name: CHANNEL_TYPES[62],
    icon: 'openai',
    defaultBaseUrl: 'https://sd2.83zi.com',
    supportedModels: ['sd2fast', 'sd2', 'mingiz-sd2'],
    hints: {
      key: 'X-License-Key (83zi License Key)',
      models: 'sd2fast, sd2 (SD2), mingiz-sd2 (Xinghe 2.0)',
      baseUrl: 'Presets: https://sd2.83zi.com or https://api.shishikeji.com',
      other: 'Async video: POST /api/generate-video, poll GET /api/task/{id}. mingiz-sd2 uses api.shishikeji.com with upstream xinghe-2.0. Supports JSON image_urls or multipart files=@image.png.',
    },
  },
  63: {
    id: 63,
    name: CHANNEL_TYPES[63],
    icon: 'openai',
    defaultBaseUrl: 'https://api.7tai.cc/v1',
    supportedModels: [
      'sd2-fast福利',
      'sd2-福利',
      'SD2.0-720p',
      'SD2.0-480p-fast',
      'SD2.0-480p',
    ],
    hints: {
      key: 'Bearer token (7tai API Key)',
      models:
        'sd2-fast福利, sd2-福利 (per-call); SD2.0-720p, SD2.0-480p-fast, SD2.0-480p (per-second)',
      baseUrl: 'Default: https://api.7tai.cc/v1',
      other:
        'Async video: POST /v1/video/generations, poll GET /v1/video/generations/{task_id}. Reference images must be public http(s) URLs in images[].',
    },
  },
  64: {
    id: 64,
    name: CHANNEL_TYPES[64],
    icon: 'openai',
    defaultBaseUrl: 'https://sd.12345ai.net',
    supportedModels: ['sd2-431', 'sd2-fast-431'],
    hints: {
      key: 'Bearer token (th12345ai License Key, LD-...)',
      models:
        'Client: sd2-431, sd2-fast-431. Map to upstream videos_stable / videos_stable_fast (per-task).',
      baseUrl: 'Default: https://sd.12345ai.net',
      other:
        'Async video: POST /api/tasks, poll GET /api/tasks/{id}. Pass reference images/videos/audios as public http(s) URLs (images[] → referenceImages). Recommended model mapping: sd2-431→videos_stable, sd2-fast-431→videos_stable_fast.',
    },
  },
  65: {
    id: 65,
    name: CHANNEL_TYPES[65],
    icon: 'openai',
    defaultBaseUrl: 'https://newapi.megabyai.cc',
    supportedModels: ['videos-standard', 'videos-fast', 'videos-mini'],
    hints: {
      key: 'Bearer token (MegaByAI API Key)',
      models: 'videos-standard, videos-fast, videos-mini (per-task)',
      baseUrl: 'Default: https://newapi.megabyai.cc',
      other:
        'Async video: POST /v1/videos, poll GET /v1/videos/{id}, content GET .../content. Maps size→ratio/resolution, images→referenceImages. Supports referenceVideos/referenceAudios. No first_image/last_image.',
    },
  },
}

export const CHANNEL_83ZI_BASE_URL_PRESETS = [
  {
    value: 'https://sd2.83zi.com',
    label: '83zi SD2 — sd2.83zi.com',
  },
  {
    value: 'https://api.shishikeji.com',
    label: 'Mingiz Xinghe — api.shishikeji.com',
  },
] as const

export const CHANNEL_83ZI_CUSTOM_BASE_URL = '__custom__'

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
