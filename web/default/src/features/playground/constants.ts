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
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
} as const

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

// ========== Video generation constants ==========

export const VIDEO_API_ENDPOINTS = {
  SUBMIT: '/v1/video/generations',
  STATUS: (taskId: string) => `/v1/video/generations/${taskId}`,
} as const

export const VIDEO_TASK_STATUS = {
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const HAPPYHORSE_MODEL_PREFIX = 'happyhorse-'

import type { VideoModelConfig, VideoModelType } from './types'

export const HAPPYHORSE_MODELS: VideoModelConfig[] = [
  {
    model: 'happyhorse-1.0-t2v',
    label: '文生视频 (Text-to-Video)',
    type: 'text-to-video',
    requiresImage: false,
    requiresVideo: false,
    supportedSizes: ['720P', '1080P'],
    durationRange: [2, 15],
  },
  {
    model: 'happyhorse-1.0-i2v',
    label: '图生视频 (Image-to-Video)',
    type: 'image-to-video',
    requiresImage: true,
    requiresVideo: false,
    supportedSizes: ['720P', '1080P'],
    durationRange: [2, 15],
  },
  {
    model: 'happyhorse-1.0-r2v',
    label: '首尾帧生视频 (Reference-to-Video)',
    type: 'reference-to-video',
    requiresImage: true,
    requiresVideo: false,
    supportedSizes: ['720P', '1080P'],
    durationRange: [2, 15],
  },
  {
    model: 'happyhorse-1.0-video-edit',
    label: '视频编辑 (Video Edit)',
    type: 'video-edit',
    requiresImage: false,
    requiresVideo: true,
    supportedSizes: ['720P', '1080P'],
    durationRange: [2, 15],
  },
]

export const VIDEO_MODEL_TYPE_LABELS: Record<VideoModelType, string> = {
  'text-to-video': 'T2V',
  'image-to-video': 'I2V',
  'reference-to-video': 'R2V',
  'video-edit': 'Edit',
}

export const VIDEO_POLLING_INTERVAL = 5000

export const STORAGE_KEYS_VIDEO = {
  TASK_QUEUE: 'playground_video_tasks',
  TOKEN_ID: 'playground_video_token_id',
} as const

// Message action labels
export const MESSAGE_ACTION_LABELS = {
  COPY: 'Copy',
  COPIED: 'Copied!',
  REGENERATE: 'Regenerate',
  EDIT: 'Edit',
  DELETE: 'Delete',
  NO_CONTENT: 'No content to copy',
  WAIT_GENERATION: 'Please wait for the current generation to complete',
} as const
