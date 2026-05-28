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
import { useCallback, useState } from 'react'
import {
  createLoadingAssistantMessage,
  createUserMessage,
  updateCurrentVersionContent,
} from '../lib'
import type { Message } from '../types'

type UsePlaygroundConversationOptions = {
  messages: Message[]
  updateMessages: (
    updater: Message[] | ((prev: Message[]) => Message[])
  ) => void
  sendChat: (messages: Message[]) => void
}

export function usePlaygroundConversation({
  messages,
  updateMessages,
  sendChat,
}: UsePlaygroundConversationOptions) {
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(
    null
  )

  const handleSendMessage = useCallback(
    (text: string) => {
      const userMessage = createUserMessage(text)
      const assistantMessage = createLoadingAssistantMessage()
      const nextMessages = [...messages, userMessage, assistantMessage]

      updateMessages(nextMessages)
      sendChat(nextMessages)
    },
    [messages, updateMessages, sendChat]
  )

  const handleRegenerateMessage = useCallback(
    (message: Message) => {
      const messageIndex = messages.findIndex((m) => m.key === message.key)
      if (messageIndex === -1) return

      const nextMessages = [
        ...messages.slice(0, messageIndex),
        createLoadingAssistantMessage(),
      ]

      updateMessages(nextMessages)
      sendChat(nextMessages)
    },
    [messages, updateMessages, sendChat]
  )

  const handleEditMessage = useCallback((message: Message) => {
    setEditingMessageKey(message.key)
  }, [])

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingMessageKey(null)
    }
  }, [])

  const applyEdit = useCallback(
    (newContent: string, shouldSubmit: boolean) => {
      if (!editingMessageKey) return

      const messageIndex = messages.findIndex(
        (message) => message.key === editingMessageKey
      )
      if (messageIndex === -1) return

      const updatedMessages = messages.map((message) => {
        if (message.key !== editingMessageKey) {
          return message
        }

        return updateCurrentVersionContent(message, newContent)
      })

      setEditingMessageKey(null)

      if (!shouldSubmit || updatedMessages[messageIndex].from !== 'user') {
        updateMessages(updatedMessages)
        return
      }

      const nextMessages = [
        ...updatedMessages.slice(0, messageIndex + 1),
        createLoadingAssistantMessage(),
      ]

      updateMessages(nextMessages)
      sendChat(nextMessages)
    },
    [editingMessageKey, messages, updateMessages, sendChat]
  )

  const handleDeleteMessage = useCallback(
    (message: Message) => {
      updateMessages((previousMessages) =>
        previousMessages.filter(
          (previousMessage) => previousMessage.key !== message.key
        )
      )
    },
    [updateMessages]
  )

  return {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  }
}
