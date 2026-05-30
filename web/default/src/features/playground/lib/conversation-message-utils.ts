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
import type { Message } from '../types'
import {
  createLoadingAssistantMessage,
  createUserMessage,
  updateCurrentVersionContent,
} from './message-utils'

type ApplyMessageEditResult = {
  messages: Message[]
  shouldSend: boolean
}

export function appendUserMessagePair(
  messages: Message[],
  content: string
): Message[] {
  return [
    ...messages,
    createUserMessage(content),
    createLoadingAssistantMessage(),
  ]
}

export function createRegeneratedMessages(
  messages: Message[],
  messageKey: string
): Message[] | null {
  const messageIndex = messages.findIndex((message) => message.key === messageKey)

  if (messageIndex === -1) {
    return null
  }

  return [...messages.slice(0, messageIndex), createLoadingAssistantMessage()]
}

export function applyMessageEdit(
  messages: Message[],
  messageKey: string,
  content: string,
  shouldSubmit: boolean
): ApplyMessageEditResult | null {
  const messageIndex = messages.findIndex((message) => message.key === messageKey)

  if (messageIndex === -1) {
    return null
  }

  const updatedMessages = messages.map((message) =>
    message.key === messageKey
      ? updateCurrentVersionContent(message, content)
      : message
  )

  if (!shouldSubmit || updatedMessages[messageIndex].from !== 'user') {
    return { messages: updatedMessages, shouldSend: false }
  }

  return {
    messages: [
      ...updatedMessages.slice(0, messageIndex + 1),
      createLoadingAssistantMessage(),
    ],
    shouldSend: true,
  }
}
