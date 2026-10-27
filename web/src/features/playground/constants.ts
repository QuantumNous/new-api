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
import type { PlaygroundConfig, ParameterEnabled } from './types'

// Message constants
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const

export const MESSAGE_STATUS = {
  LOADING: 'loading',
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const

// API endpoints
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/pg/chat/completions',
  IMAGE_GENERATIONS: '/pg/images/generations',
  VIDEO_GENERATIONS: '/pg/video/generations',
  USER_MODELS: '/api/user/models',
  USER_MODEL_KINDS: '/api/user/models/kinds',
  USER_GROUPS: '/api/user/self/groups',
  GENERATION_RECORDS: '/api/generation/records',
} as const

// Playground modes. Only chat is backed by the conversation transcript; the two
// generation modes keep their own one-shot history because a task result has no
// turn structure to preserve.
export const PLAYGROUND_MODES = {
  CHAT: 'chat',
  IMAGE: 'image',
  VIDEO: 'video',
} as const

export const PRICING_KINDS = {
  CHAT: 'chat',
  MULTIMODAL_CHAT: 'multimodal-chat',
  IMAGE_GEN: 'image-gen',
  VIDEO_GEN: 'video-gen',
} as const

// Generation parameters. An empty value means "let the model decide", which is
// the safest default: accepted sizes and durations are model specific.
export const IMAGE_SIZE_OPTIONS = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '2048x2048',
] as const

export const VIDEO_RESOLUTION_OPTIONS = ['480p', '720p', '1080p'] as const

export const VIDEO_SECONDS_OPTIONS = [4, 8, 12] as const

export const UNSET_OPTION_VALUE = 'unset' as const

export const VIDEO_TASK_POLL_INTERVAL_MS = 4000

// Default group — uses 'default' as the safe fallback; auto-group is
// only selected when the backend confirms it is available for the user.
export const DEFAULT_GROUP = 'default' as const

// Default configuration
export const DEFAULT_CONFIG: PlaygroundConfig = {
  model: 'gpt-4o',
  group: DEFAULT_GROUP,
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  stream: true,
}

export const DEFAULT_PARAMETER_ENABLED: ParameterEnabled = {
  temperature: true,
  top_p: true,
  max_tokens: false,
  frequency_penalty: true,
  presence_penalty: true,
  seed: false,
}

// Storage keys
export const STORAGE_KEYS = {
  CONFIG: 'playground_config',
  MESSAGES: 'playground_messages',
  PARAMETER_ENABLED: 'playground_parameter_enabled',
} as const

// Error messages
export const ERROR_MESSAGES = {
  API_REQUEST_ERROR: 'Request error occurred',
  NETWORK_ERROR: 'Network connection failed or server not responding',
  PARSE_ERROR: 'Error parsing response data',
  STREAM_START_ERROR: 'Error establishing connection',
  CONNECTION_CLOSED: 'Connection closed',
  INTERRUPTED: 'Generation was interrupted',
} as const

// Message action button styles
export const MESSAGE_ACTION_BUTTON_STYLES = {
  BASE: 'size-7 text-muted-foreground hover:text-foreground',
  DELETE: 'size-7 text-muted-foreground hover:text-destructive',
  ICON: 'size-4',
} as const

// Message action labels
export const MESSAGE_ACTION_LABELS = {
  COPY: 'Copy',
  COPIED: 'Copied!',
  REGENERATE: 'Regenerate',
  SHOW_PREVIEW: 'Show preview',
  SHOW_SOURCE: 'Show source',
  EDIT: 'Edit',
  DELETE: 'Delete',
  NO_CONTENT: 'No content to copy',
  WAIT_GENERATION: 'Please wait for the current generation to complete',
} as const
