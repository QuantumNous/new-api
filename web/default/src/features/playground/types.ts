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

export interface GeneratedMedia {
  type: 'image' | 'video'
  url: string
}

export interface MessageVersion {
  id: string
  content: string
  attachments?: PlaygroundAttachment[]
  generatedMedia?: GeneratedMedia[]
}

export interface PlaygroundAttachment {
  kind: 'image' | 'video' | 'text'
  filename: string
  mediaType: string
  url?: string
  text?: string
}

export interface PlaygroundResponseMetadata {
  relayRequestId?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
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
  responseMetadata?: PlaygroundResponseMetadata
  // Video-generation messages (veo models). `isVideo` marks the assistant bubble
  // as a video result so it renders a progress spinner while generating and an
  // inline `<video>` when done (instead of markdown text). `videoProgress` is the
  // 0-100 poll progress; `videoUrl` is the object URL of the completed MP4 blob
  // (created via URL.createObjectURL, revoked on delete/unmount). `videoUrl` is a
  // per-session blob URL and is intentionally NOT meaningful after a reload.
  isVideo?: boolean
  videoProgress?: number
  videoUrl?: string
  // Unified media generation persists the public task id so an in-flight
  // video can resume polling after navigation or a page reload.
  videoTaskId?: string
  /** @deprecated Media is stored on MessageVersion; kept for old saved sessions. */
  generatedMedia?: GeneratedMedia[]
}

// API payload types
export interface ChatCompletionMessage {
  role: MessageRole
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url' | 'video_url'
  text?: string
  image_url?: {
    url: string
  }
  video_url?: {
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
  max_completion_tokens?: number
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
  usage?: ChatCompletionUsage
}

export interface ChatCompletionUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
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
  usage?: ChatCompletionUsage
}

// Video generation (async /v1/videos) task types
export type VideoTaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

export interface VideoTask {
  id: string
  object?: string
  status: VideoTaskStatus
  progress?: number
  // Upstream may report a failure reason as a string or an object.
  error?: string | { message?: string } | null
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

export type PlaygroundRecordStatus = 'complete' | 'error' | 'stopped'

export interface PlaygroundRecordPayload {
  record_id: string
  conversation_id: string
  user_message: Message
  request_messages: ChatCompletionMessage[]
  assistant_message: Message
  reasoning_content: string
  input_text: string
  output_text: string
  model_name: string
  group_name: string
  parameters: Record<string, unknown>
  status: PlaygroundRecordStatus
  error_code: string
  error_message: string
  relay_request_id: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  latency_ms: number
  messages_snapshot: Message[]
  client_completed_at: number
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
