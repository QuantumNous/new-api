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
import { ERROR_MESSAGES, MESSAGE_ROLES, MESSAGE_STATUS } from '../constants'
import type { ChatCompletionResponse, Message } from '../types'
import {
  getCurrentVersion,
  hasMessageContent,
  updateCurrentVersionContent,
} from './message-utils'
import { parseThinkTags } from './message-reasoning-utils'

/**
 * Process content chunk during streaming.
 * Separates <think> reasoning from visible content in real-time.
 * Note: versions[0].content keeps the full raw content with tags during streaming.
 */
export function processStreamingContent(
  message: Message,
  contentChunk?: string
): Message {
  const currentVersion = getCurrentVersion(message)
  const fullContent = contentChunk
    ? currentVersion.content + contentChunk
    : currentVersion.content

  const { reasoning, hasUnclosedTag } = parseThinkTags(fullContent)
  const finalReasoning = reasoning
    ? { content: reasoning, duration: 0 }
    : message.reasoning

  return {
    ...updateCurrentVersionContent(message, fullContent),
    reasoning: finalReasoning,
    isReasoningStreaming: hasUnclosedTag,
  }
}

export type StreamChunkType = 'reasoning' | 'content'

export function applyStreamingChunk(
  message: Message,
  type: StreamChunkType,
  chunk: string
): Message {
  if (message.status === MESSAGE_STATUS.ERROR) {
    return message
  }

  if (type === 'reasoning') {
    return {
      ...message,
      reasoning: {
        content: (message.reasoning?.content || '') + chunk,
        duration: 0,
      },
      isReasoningStreaming: true,
      status: MESSAGE_STATUS.STREAMING,
    }
  }

  return {
    ...processStreamingContent(message, chunk),
    status: MESSAGE_STATUS.STREAMING,
  }
}

/**
 * Finalize message after streaming completes.
 * Cleans content and consolidates reasoning from all sources.
 */
export function finalizeMessage(
  message: Message,
  apiReasoningContent?: string
): Message {
  const currentVersion = getCurrentVersion(message)
  const { visibleContent, reasoning } = parseThinkTags(currentVersion.content)
  const finalReasoning =
    apiReasoningContent || message.reasoning?.content || reasoning || ''

  return {
    ...updateCurrentVersionContent(message, visibleContent),
    reasoning: finalReasoning
      ? { content: finalReasoning, duration: message.reasoning?.duration || 0 }
      : undefined,
    isReasoningStreaming: false,
  }
}

export function completeAssistantMessage(message: Message): Message {
  return {
    ...finalizeMessage(message),
    status: MESSAGE_STATUS.COMPLETE,
  }
}

type ChatCompletionChoice = ChatCompletionResponse['choices'][number]

export function applyChatCompletionChoice(
  message: Message,
  choice: ChatCompletionChoice
): Message {
  return {
    ...finalizeMessage(
      updateCurrentVersionContent(message, choice.message?.content || ''),
      choice.message?.reasoning_content
    ),
    status: MESSAGE_STATUS.COMPLETE,
  }
}

/**
 * Sanitize messages loaded from storage.
 * Converts stuck loading/streaming messages to stable state.
 */
export function sanitizeMessagesOnLoad(messages: Message[]): Message[] {
  let targetIndex = -1

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const isPendingAssistant =
      message?.from === MESSAGE_ROLES.ASSISTANT &&
      (message?.status === MESSAGE_STATUS.LOADING ||
        message?.status === MESSAGE_STATUS.STREAMING)

    if (isPendingAssistant) {
      targetIndex = i
      break
    }
  }

  if (targetIndex === -1) return messages

  const finalized = finalizeMessage(messages[targetIndex])
  const hasContent = hasMessageContent(finalized)
  const hasReasoning = finalized.reasoning?.content?.trim()

  const sanitized: Message =
    hasContent || hasReasoning
      ? {
          ...finalized,
          status: MESSAGE_STATUS.COMPLETE,
          isReasoningStreaming: false,
        }
      : {
          ...updateCurrentVersionContent(
            finalized,
            `${ERROR_MESSAGES.API_REQUEST_ERROR}: ${ERROR_MESSAGES.INTERRUPTED}`
          ),
          status: MESSAGE_STATUS.ERROR,
          isReasoningStreaming: false,
        }

  const result = [...messages]
  result[targetIndex] = sanitized
  return result
}
