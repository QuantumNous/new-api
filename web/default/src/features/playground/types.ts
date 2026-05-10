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

export type PlaygroundEndpoint =
  | 'chat-completions'
  | 'responses'
  | 'claude-messages'
  | 'image-generations'

export interface PlaygroundImage {
  url?: string
  b64_json?: string
  mime_type?: string
}

export interface MessageVersion {
  id: string
  content: string
}

export interface Message {
  key: string
  from: MessageRole
  versions: MessageVersion[]
  sources?: { href: string; title: string }[]
  images?: PlaygroundImage[]
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

export interface ResponsesRequest {
  model: string
  group?: string
  input: ChatCompletionMessage[]
  instructions?: string
  stream?: boolean
  temperature?: number
  top_p?: number
  max_output_tokens?: number
  tools?: Array<Record<string, unknown>>
}

export interface ClaudeMessagesRequest {
  model: string
  group?: string
  system?: string
  messages: ChatCompletionMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens: number
}

export interface ImageGenerationRequest {
  model: string
  group?: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  response_format?: string
}

export type PlaygroundRequest =
  | ChatCompletionRequest
  | ResponsesRequest
  | ClaudeMessagesRequest
  | ImageGenerationRequest

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
  endpointOverride: PlaygroundEndpoint | null
  temperature: number
  top_p: number
  max_tokens: number
  max_output_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number | null
  stream: boolean
  image_size: string
  image_quality: string
  image_n: number
  image_response_format: string
}

export interface ParameterEnabled {
  temperature: boolean
  top_p: boolean
  max_tokens: boolean
  frequency_penalty: boolean
  presence_penalty: boolean
  seed: boolean
}

export interface ModelOption {
  label: string
  value: string
  endpoint?: PlaygroundEndpoint
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}
