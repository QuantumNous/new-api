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

export type ManagedToolStatus =
  | 'queued'
  | 'running'
  | 'submitted'
  | 'completed'
  | 'failed'

export type ManagedToolCard = {
  runId?: number
  action: 'generate_image' | 'generate_video' | 'web_search'
  status: ManagedToolStatus
  model?: string
  taskId?: string
  images?: string[]
  videoUrl?: string
  error?: string
}

export type MessageSource = {
  href: string
  title: string
  snippet?: string
  domain?: string
  publishedAt?: string
}

export type PlaygroundMessageLayoutMode = 'alternating' | 'left'

export type MessageTokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface MessageVersion {
  id: string
  content: string
}

type ChatAttachmentBase = {
  id: string
  name: string
  mimeType: string
}

/**
 * Image backed by a playground asset. `dataUrl` holds the bytes for the
 * current tab; after a reload only `assetId` survives and the bytes are
 * refetched before the next request.
 */
export type ChatImageAttachment = ChatAttachmentBase & {
  kind: 'image'
  dataUrl?: string
  assetId?: number
}

export type ChatDocumentParseStatus = 'processing' | 'ocr' | 'done' | 'failed'

/**
 * Document attachment. Only extracted text ever reaches the model, so any
 * chat model can consume any document. Plain-text files are read in the
 * browser; PDF/Office files are uploaded (`assetId`) and parsed server-side,
 * with `status` tracking that pipeline. Absent status means done (legacy).
 */
export type ChatDocumentAttachment = ChatAttachmentBase & {
  kind: 'document'
  text: string
  assetId?: number
  status?: ChatDocumentParseStatus
  error?: string
  /** OCR progress while status is 'ocr' */
  ocrDone?: number
  ocrTotal?: number
}

export type ChatAttachment = ChatImageAttachment | ChatDocumentAttachment

export interface Message {
  key: string
  from: MessageRole
  versions: MessageVersion[]
  /** Inline images and PDFs attached to a user turn */
  attachments?: ChatAttachment[]
  createdAt?: number
  startedAt?: number
  completedAt?: number
  durationMs?: number
  sources?: MessageSource[]
  managedTool?: ManagedToolCard
  /**
   * Model that produced this assistant turn. Absent on legacy messages
   * (shown as "model not recorded").
   */
  model?: string
  /** Visible marker when the user switches models mid-thread. */
  modelChangeFrom?: string
  modelChangeTo?: string
  reasoning?: {
    content: string
    duration: number
    startedAt?: number
    completedAt?: number
    durationMs?: number
  }
  isReasoningStreaming?: boolean
  isReasoningComplete?: boolean
  isContentComplete?: boolean
  status?: MessageStatus
  errorCode?: string | null
  usage?: MessageTokenUsage
}

// API payload types
export interface ChatCompletionMessage {
  role: MessageRole
  content: string | ContentPart[]
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatCompletionRequest {
  model: string
  group?: string
  messages: ChatCompletionMessage[]
  stream: boolean
  stream_options?: { include_usage: boolean }
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
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
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

export type StudioModality = 'chat' | 'image' | 'video' | 'audio'

export type StudioSettings = {
  imageCount: number
  imageSize: string
  imageQuality: string
  videoDuration: number
  videoSize: string
  voice: string
  speed: number
  audioFormat: string
}

export type GeneratedImage = {
  url: string
  revisedPrompt?: string
  /** Set when the image was persisted to a playground asset before display. */
  assetId?: number
}

export type VideoSubmission = {
  taskId: string
  status?: string
}
