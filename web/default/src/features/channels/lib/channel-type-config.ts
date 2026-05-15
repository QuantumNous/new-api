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
