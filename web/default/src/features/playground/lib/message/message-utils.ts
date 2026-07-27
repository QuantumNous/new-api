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
import { nanoid } from 'nanoid'

import { MESSAGE_ROLES, MESSAGE_STATUS } from '../../constants'
import type {
  Message,
  MessageVersion,
  ChatCompletionMessage,
  ChatAttachment,
  ContentPart,
} from '../../types'
import { hasAttachmentPayload } from '../attachments/attachment-utils'

/**
 * Create a new message version
 */
export function createMessageVersion(content: string): MessageVersion {
  return {
    id: nanoid(),
    content,
  }
}

/**
 * Index of the version being displayed/streamed. Defaults to the latest
 * version so regenerated answers surface immediately.
 */
export function getActiveVersionIndex(message: Message): number {
  const lastIndex = Math.max(message.versions.length - 1, 0)
  const index = message.activeVersion ?? lastIndex
  return Math.min(Math.max(index, 0), lastIndex)
}

/**
 * Get the active version from a message.
 */
export function getCurrentVersion(message: Message): MessageVersion {
  return (
    message.versions[getActiveVersionIndex(message)] || {
      id: 'default',
      content: '',
    }
  )
}

/**
 * Get displayable content from the current message version.
 */
export function getMessageContent(message: Message): string {
  return getCurrentVersion(message).content
}

/**
 * Check whether a message has non-empty content in its current version.
 */
export function hasMessageContent(message: Message): boolean {
  return getMessageContent(message).trim() !== ''
}

/**
 * Update the active version's content, preserving the other versions.
 */
export function updateCurrentVersionContent(
  message: Message,
  content: string
): Message {
  if (message.versions.length === 0) {
    return { ...message, versions: [createMessageVersion(content)] }
  }
  const index = getActiveVersionIndex(message)
  const versions = [...message.versions]
  versions[index] = { ...versions[index], content }
  return { ...message, versions }
}

export const MAX_MESSAGE_VERSIONS = 8

/**
 * Start a fresh regeneration on an assistant message: append an empty
 * version, make it active, and reset streaming state. Oldest versions are
 * dropped beyond MAX_MESSAGE_VERSIONS to bound storage.
 */
export function addAssistantMessageVersion(
  message: Message,
  model?: string
): Message {
  const startedAt = Date.now()
  const versions = [...message.versions, createMessageVersion('')]
  while (versions.length > MAX_MESSAGE_VERSIONS) versions.shift()
  return {
    ...message,
    versions,
    activeVersion: versions.length - 1,
    startedAt,
    completedAt: undefined,
    durationMs: undefined,
    usage: undefined,
    sources: undefined,
    model: model || message.model,
    reasoning: undefined,
    isReasoningComplete: false,
    isContentComplete: false,
    isReasoningStreaming: false,
    status: MESSAGE_STATUS.LOADING,
  }
}

/**
 * Switch which stored version an assistant message displays.
 */
export function setMessageActiveVersion(
  message: Message,
  index: number
): Message {
  if (index < 0 || index >= message.versions.length) {
    return message
  }
  return { ...message, activeVersion: index }
}

/**
 * Create a user message
 */
export function createUserMessage(
  content: string,
  createdAt: number = Date.now(),
  attachments?: ChatAttachment[]
): Message {
  const validAttachments = attachments?.filter(hasAttachmentPayload)
  return {
    key: nanoid(),
    from: MESSAGE_ROLES.USER,
    versions: [createMessageVersion(content)],
    attachments:
      validAttachments && validAttachments.length > 0
        ? validAttachments
        : undefined,
    createdAt,
  }
}

/**
 * Create a loading assistant message
 */
export function createLoadingAssistantMessage(
  startedAt: number = Date.now(),
  model?: string
): Message {
  return {
    key: nanoid(),
    from: MESSAGE_ROLES.ASSISTANT,
    versions: [createMessageVersion('')],
    createdAt: startedAt,
    startedAt,
    model: model || undefined,
    reasoning: undefined,
    isReasoningComplete: false,
    isContentComplete: false,
    isReasoningStreaming: false,
    status: MESSAGE_STATUS.LOADING,
  }
}

function documentTextPart(name: string, text: string): ContentPart {
  return {
    type: 'text',
    text: `Attached document "${name}":\n\n${text.trim()}`,
  }
}

/**
 * Build message content with optional images and parsed document text.
 * Documents always contribute plain text (extracted server-side), so any
 * chat model can consume them.
 */
export function buildMessageContent(
  text: string,
  attachments: ChatAttachment[] = []
): string | ContentPart[] {
  const validAttachments = attachments.filter(hasAttachmentPayload)

  if (validAttachments.length === 0) {
    return text
  }

  const parts: ContentPart[] = [
    {
      type: 'text',
      text: text || '',
    },
  ]

  for (const attachment of validAttachments) {
    if (attachment.kind === 'document') {
      parts.push(documentTextPart(attachment.name, attachment.text))
      continue
    }
    const dataUrl = attachment.dataUrl?.trim() ?? ''
    if (dataUrl) {
      parts.push({ type: 'image_url', image_url: { url: dataUrl } })
    }
  }

  return parts
}

/**
 * Extract text content from message content
 */
export function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const textPart = content.find((part) => part.type === 'text')
    return textPart?.text || ''
  }

  return ''
}

/**
 * Format message for API request
 */
export function formatMessageForAPI(message: Message): ChatCompletionMessage {
  const currentVersion = getCurrentVersion(message)
  if (message.from === MESSAGE_ROLES.USER && message.attachments?.length) {
    return {
      role: message.from,
      content: buildMessageContent(currentVersion.content, message.attachments),
    }
  }
  return {
    role: message.from,
    content: currentVersion.content,
  }
}

/**
 * Check if message is valid for API request
 * Excludes loading/streaming assistant messages and empty content
 */
export function isValidMessage(message: Message): boolean {
  if (!message || !message.from || !message.versions.length) return false

  // Exclude empty assistant messages (loading/streaming placeholders)
  if (message.from === MESSAGE_ROLES.ASSISTANT && !hasMessageContent(message)) {
    return false
  }

  return true
}
