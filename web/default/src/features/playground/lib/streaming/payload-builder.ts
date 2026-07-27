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
import type {
  ChatCompletionMessage,
  ChatCompletionRequest,
  Message,
  PlaygroundConfig,
  ParameterEnabled,
} from '../../types'
import { formatMessageForAPI, isValidMessage } from '../message/message-utils'
import { clampSystemPrompt } from '../workbench/workbench-prefs'

export type BuildChatPayloadOptions = {
  /** Prepended as a system message when non-empty */
  systemPrompt?: string
  /** When false, only the latest user turn is sent (plus system prompt) */
  carryHistory?: boolean
  /** When true, appends the platform visual-output capability prompt */
  visualOutput?: boolean
}

/**
 * Tells the model which rich Markdown fences the client can render.
 * Must stay in sync with the renderers in components/ai-elements
 * (chart-spec.ts, mermaid-diagram.tsx, html-preview-fence.tsx).
 */
export const VISUAL_OUTPUT_SYSTEM_PROMPT = [
  'When visual output communicates better than prose, use these Markdown fences; the client renders them:',
  '- ```chart — JSON {"type":"bar"|"line"|"area"|"pie","title"?,"xKey"?,"yKeys"?,"data":[{...}]} (max 500 rows) for numeric comparisons and trends.',
  '- ```mermaid — flowchart, sequence, state, ER, and gantt diagrams.',
  '- ```html — a self-contained interactive demo (inline CSS/JS only; rendered in a sandboxed iframe without network access).',
  '- ```svg — vector graphics.',
  'LaTeX math ($...$ or $$...$$) and GFM tables are also rendered. Otherwise reply normally.',
].join('\n')

export const MAX_CHAT_PAYLOAD_BYTES = 30 * 1024 * 1024

export function isChatCompletionPayloadTooLarge(
  payload: ChatCompletionRequest
): boolean {
  return (
    new TextEncoder().encode(JSON.stringify(payload)).byteLength >
    MAX_CHAT_PAYLOAD_BYTES
  )
}

/**
 * Build API request payload from messages and config
 */
export function buildChatCompletionPayload(
  messages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled,
  options?: BuildChatPayloadOptions
): ChatCompletionRequest {
  // Filter and format valid messages
  let sourceMessages = messages.filter(isValidMessage)
  if (options?.carryHistory === false) {
    // Keep the last user message only (and any trailing assistant is not needed for request)
    const lastUserIndex = [...sourceMessages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find((entry) => entry.message.from === 'user')?.index
    sourceMessages =
      lastUserIndex === undefined
        ? []
        : sourceMessages.slice(lastUserIndex, lastUserIndex + 1)
  }

  const processedMessages: ChatCompletionMessage[] =
    sourceMessages.map(formatMessageForAPI)

  const personaPrompt = clampSystemPrompt(options?.systemPrompt).trim()
  const systemPrompt = [
    personaPrompt,
    options?.visualOutput ? VISUAL_OUTPUT_SYSTEM_PROMPT : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  if (systemPrompt) {
    processedMessages.unshift({
      role: 'system',
      content: systemPrompt,
    })
  }

  const payload: ChatCompletionRequest = {
    model: config.model,
    group: config.group,
    messages: processedMessages,
    stream: config.stream,
  }

  if (config.stream) {
    payload.stream_options = { include_usage: true }
  }

  if (parameterEnabled.temperature) {
    payload.temperature = config.temperature
  }

  if (parameterEnabled.top_p) {
    payload.top_p = config.top_p
  }

  if (parameterEnabled.max_tokens) {
    payload.max_tokens = config.max_tokens
  }

  if (parameterEnabled.frequency_penalty) {
    payload.frequency_penalty = config.frequency_penalty
  }

  if (parameterEnabled.presence_penalty) {
    payload.presence_penalty = config.presence_penalty
  }

  if (parameterEnabled.seed && config.seed !== null) {
    payload.seed = config.seed
  }

  return payload
}
