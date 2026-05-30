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
import { useEffect, useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message } from '@/components/ai-elements/message'
import {
  getChatMessageRenderState,
  getEditingMessageContent,
  getPreviousUserMessage,
  isErrorMessage,
} from '../lib'
import type { Message as MessageType } from '../types'
import { MessageActions } from './message-actions'
import { MessageErrorActions } from './message-error-actions'
import { PlaygroundEmptyState } from './playground-empty-state'
import { PlaygroundMessageContent } from './playground-message-content'
import { PlaygroundMessageEditor } from './playground-message-editor'

interface PlaygroundChatProps {
  messages: MessageType[]
  onCopyMessage?: (message: MessageType) => void
  onRegenerateMessage?: (message: MessageType) => void
  onEditMessage?: (message: MessageType) => void
  onDeleteMessage?: (message: MessageType) => void
  onSelectPrompt?: (prompt: string) => void
  isGenerating?: boolean
  editingKey?: string | null
  onSaveEdit?: (newContent: string) => void
  onCancelEdit?: (open: boolean) => void
  onSaveEditAndSubmit?: (newContent: string) => void
}

export function PlaygroundChat({
  messages,
  onCopyMessage,
  onRegenerateMessage,
  onEditMessage,
  onDeleteMessage,
  onSelectPrompt,
  isGenerating = false,
  editingKey,
  onSaveEdit,
  onCancelEdit,
  onSaveEditAndSubmit,
}: PlaygroundChatProps) {
  const [editText, setEditText] = useState('')
  const [originalText, setOriginalText] = useState('')

  useEffect(() => {
    if (!editingKey) return
    const content = getEditingMessageContent(messages, editingKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditText(content)

    setOriginalText(content)
  }, [editingKey, messages])

  return (
    <Conversation>
      {/* Remove outer padding; apply padding to inner centered container to align with input */}
      <ConversationContent className='p-0'>
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>
          {messages.length === 0 && onSelectPrompt ? (
            <PlaygroundEmptyState onSelectPrompt={onSelectPrompt} />
          ) : (
            messages.map((message, messageIndex) => {
              const { alwaysShowActions, content, isEditing } =
                getChatMessageRenderState(
                  messages,
                  message,
                  messageIndex,
                  editingKey
                )
              const isError = isErrorMessage(message)
              const previousUserMessage = isError
                ? getPreviousUserMessage(messages, messageIndex)
                : null

              return (
                <Message
                  className='group flex-row-reverse'
                  from={message.from}
                  key={message.key}
                >
                  <div className='w-full min-w-0 flex-1 basis-full py-1'>
                    {isEditing ? (
                      <PlaygroundMessageEditor
                        editText={editText}
                        message={message}
                        onCancelEdit={onCancelEdit}
                        onEditTextChange={setEditText}
                        onSaveEdit={onSaveEdit}
                        onSaveEditAndSubmit={onSaveEditAndSubmit}
                        originalText={originalText}
                      />
                    ) : (
                      <PlaygroundMessageContent
                        actions={
                          <MessageActions
                            message={message}
                            onCopy={onCopyMessage}
                            onRegenerate={onRegenerateMessage}
                            onEdit={onEditMessage}
                            onDelete={onDeleteMessage}
                            isGenerating={isGenerating}
                            alwaysVisible={alwaysShowActions}
                            className='mt-1'
                          />
                        }
                        message={message}
                        errorActions={
                          isError ? (
                            <MessageErrorActions
                              disabled={isGenerating}
                              onRetry={
                                onRegenerateMessage
                                  ? () => onRegenerateMessage(message)
                                  : undefined
                              }
                              onEditPrompt={
                                onEditMessage && previousUserMessage
                                  ? () => onEditMessage(previousUserMessage)
                                  : undefined
                              }
                              onDelete={
                                onDeleteMessage
                                  ? () => onDeleteMessage(message)
                                  : undefined
                              }
                            />
                          ) : undefined
                        }
                        versionContent={content}
                      />
                    )}
                  </div>
                </Message>
              )
            })
          )}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
