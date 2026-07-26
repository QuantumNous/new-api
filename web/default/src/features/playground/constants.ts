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
  IMAGE_GENERATIONS: '/pg/images/generations',
  IMAGE_EDITS: '/pg/images/edits',
  VIDEO_GENERATIONS: '/pg/video/generations',
  AUDIO_SPEECH: '/pg/audio/speech',
  ESTIMATE: '/api/playground/estimate',
  ASSETS: '/api/playground/assets',
  UPLOAD_SESSIONS: '/api/playground/upload-sessions',
  CONVERSATIONS: '/api/playground/conversations',
  PROJECTS: '/api/playground/projects',
  PERSONAS: '/api/playground/personas',
  PLAYGROUND_TASKS: '/api/playground/tasks',
  PLAYGROUND_RUNS: '/api/playground/runs',
  CHAT_MULTI: '/api/playground/chat/multi',
  INSPIRATION_CATEGORIES: '/api/playground/inspiration/categories',
  INSPIRATION_TEMPLATES: '/api/playground/inspiration/templates',
  SKILL: '/api/playground/skill',
  SKILL_MD: '/api/playground/skill.md',
  VOICES: '/api/playground/voices',
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
  STUDIO: 'playground_studio',
  WORKBENCH: 'playground_workbench_prefs_v1',
  STORE: 'playground_store_v2',
  /** Marker so the legacy global messages array is imported at most once. */
  LEGACY_MESSAGES_IMPORTED: 'playground_legacy_messages_imported_v1',
} as const

// Error messages
export const ERROR_MESSAGES = {
  API_REQUEST_ERROR: 'Request error occurred',
  REQUEST_TOO_LARGE: 'Request is too large (max 30MB).',
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
