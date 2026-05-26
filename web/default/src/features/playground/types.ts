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
// Message types
export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'loading' | 'streaming' | 'complete' | 'error'

export interface MessageVersion {
  id: string
  content: string
}

export interface Message {
  key: string
  from: MessageRole
  versions: MessageVersion[]
  sources?: { href: string; title: string }[]
  reasoning?: {
    content: string
    duration: number
  }
  isReasoningStreaming?: boolean
  isReasoningComplete?: boolean
  isContentComplete?: boolean
  status?: MessageStatus
  errorCode?: string | null
}

// API payload types
export interface ChatCompletionMessage {
  role: MessageRole
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface ChatCompletionRequest {
  model: string
  group?: string
  messages: ChatCompletionMessage[]
  stream: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: MessageRole
      content?: string
      reasoning_content?: string
    }
    finish_reason: string | null
  }>
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: MessageRole
      content: string
      reasoning_content?: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Configuration types
export interface PlaygroundConfig {
  model: string
  group: string
  temperature: number
  top_p: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number | null
  stream: boolean
}

export interface ParameterEnabled {
  temperature: boolean
  top_p: boolean
  max_tokens: boolean
  frequency_penalty: boolean
  presence_penalty: boolean
  seed: boolean
}

// Model and group options
export interface ModelOption {
  label: string
  value: string
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}

// ========== Video generation types ==========

export type VideoTaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

export interface TokenOption {
  id: number
  name: string
  key: string
}

export interface VideoGenerationRequest {
  model: string
  prompt: string
  size?: string
  duration?: number
  images?: string[]
  input_reference?: string
  metadata?: {
    prompt_extend?: boolean
    seed?: number
    watermark?: boolean
  }
}

export interface VideoTaskResponse {
  id: string
  task_id?: string
  object: string
  model: string
  status: VideoTaskStatus
  progress: number
  created_at: number
  completed_at?: number
  error?: { message: string; code: string }
  metadata?: Record<string, unknown>
}

export interface VideoTaskItem {
  id: string
  model: string
  prompt: string
  status: VideoTaskStatus
  progress: number
  createdAt: number
  completedAt?: number
  videoUrl?: string
  error?: string
  size?: string
  duration?: number
  type?: VideoModelType
  tokenId?: number
}

export type VideoModelType =
  | 'text-to-video'
  | 'image-to-video'
  | 'reference-to-video'
  | 'video-edit'

export interface VideoModelConfig {
  model: string
  label: string
  type: VideoModelType
  requiresImage: boolean
  requiresVideo: boolean
  supportedSizes: string[]
  durationRange: [number, number]
}
