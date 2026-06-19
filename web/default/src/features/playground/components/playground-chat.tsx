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
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
} from '@/components/ai-elements/branch'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { MESSAGE_ROLES } from '../constants'
import { getMessageContentStyles } from '../lib/message-styles'
import { parseThinkTags } from '../lib/message-utils'
import type { Message as MessageType } from '../types'
import { MessageActions } from './message-actions'
import { MessageError } from './message-error'

// Check if a URL is an image URL
const isImageUrl = (url: string) => {
  if (!url) return false
  const lower = url.toLowerCase()
  return (
    lower.match(/\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/) !== null ||
    lower.includes('r2.dev/') ||
    lower.includes('r2.cloudflarestorage.com/')
  )
}

// Check if a source is a file attachment (not an image URL)
const isFileSource = (source: { href: string; title: string }) =>
  !source.href || !isImageUrl(source.href)

interface PlaygroundChatProps {
  messages: MessageType[]
  onCopyMessage?: (message: MessageType) => void
  onRegenerateMessage?: (message: MessageType) => void
  onEditMessage?: (message: MessageType) => void
  onDeleteMessage?: (message: MessageType) => void
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
    const message = messages.find((m) => m.key === editingKey)
    const content = message?.versions?.[0]?.content || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditText(content)

    setOriginalText(content)
  }, [editingKey, messages])

  const isEditing = (key: string) => editingKey === key
  const isEmpty = useMemo(() => !editText.trim(), [editText])
  const isChanged = useMemo(
    () => editText !== originalText,
    [editText, originalText]
  )
  return (
    <Conversation>
      {/* Remove outer padding; apply padding to inner centered container to align with input */}
      <ConversationContent className='p-0'>
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>
          {messages.map((message, messageIndex) => {
            const { versions = [] } = message
            const isUser = message.from === MESSAGE_ROLES.USER
            const isAssistant = message.from === MESSAGE_ROLES.ASSISTANT
            const isLastAssistantMessage =
              messageIndex === messages.length - 1 && isAssistant

            // Separate image sources from file sources
            const imageSources = message.sources?.filter((s) =>
              isImageUrl(s.href)
            )
            const fileSources = message.sources?.filter(isFileSource)
            const hasImages = !!imageSources?.length
            const hasFiles = !!fileSources?.length

            return (
              <Branch defaultBranch={0} key={message.key}>
                <BranchMessages>
                  {versions.map((version, versionIndex) => (
                    <Message
                      from={message.from}
                      key={`${message.key}-${version.id}-${versionIndex}`}
                    >
                      <div
                        className={cn(
                          'min-w-0 py-1',
                          isUser
                            ? 'flex flex-col items-end max-w-[85%]'
                            : 'w-full flex-1 basis-full'
                        )}
                      >
                        {isEditing(message.key) ? (
                          <div className='w-full space-y-2'>
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className='font-mono text-sm'
                              rows={8}
                            />
                            <div className='flex gap-2'>
                              {/* Save & Submit only makes sense for user messages */}
                              {isUser && (
                                <Button
                                  size='sm'
                                  onClick={() =>
                                    onSaveEditAndSubmit?.(editText)
                                  }
                                  disabled={isEmpty || !isChanged}
                                >
                                  Save & Submit
                                </Button>
                              )}
                              <Button
                                size='sm'
                                onClick={() => onSaveEdit?.(editText)}
                                disabled={isEmpty || !isChanged}
                              >
                                Save
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => onCancelEdit?.(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const showReasoning =
                                isAssistant && !!message.reasoning?.content
                              const showLoader =
                                isAssistant &&
                                !message.isReasoningStreaming &&
                                (message.status === 'loading' ||
                                  (message.status === 'streaming' &&
                                    !version.content))
                              const showMessageContent =
                                (isUser || !message.isReasoningStreaming) &&
                                !!version.content

                              // Extract visible content (remove <think> tags for assistant messages)
                              let displayContent = isAssistant
                                ? parseThinkTags(version.content).visibleContent
                                : version.content

                              // For user messages, strip markdown image syntax (we show thumbnails instead)
                              if (isUser && hasImages) {
                                displayContent = displayContent
                                  .replace(/\n\n!\[image\]\([^)]+\)/g, '')
                                  .trim()
                              }

                              const actions = (
                                <MessageActions
                                  message={message}
                                  onCopy={onCopyMessage}
                                  onRegenerate={onRegenerateMessage}
                                  onEdit={onEditMessage}
                                  onDelete={onDeleteMessage}
                                  isGenerating={isGenerating}
                                  alwaysVisible={isLastAssistantMessage}
                                  className='mt-1'
                                />
                              )

                              return (
                                <>
                                  {/* Image thumbnails in user message (instead of "Used X sources") */}
                                  {isUser && hasImages && (
                                    <div className='mb-1.5 flex flex-wrap justify-end gap-1.5'>
                                      {imageSources!.map((source, idx) => (
                                        <img
                                          key={`${message.key}-img-${idx}`}
                                          src={source.href}
                                          alt='Attached'
                                          className='h-20 w-20 cursor-pointer rounded-lg border object-cover shadow-sm transition-transform hover:scale-105'
                                          onClick={() =>
                                            window.open(source.href, '_blank')
                                          }
                                        />
                                      ))}
                                    </div>
                                  )}

                                  {/* File chip in user message */}
                                  {isUser && hasFiles && (
                                    <div className='mb-1.5 flex flex-wrap justify-end gap-1.5'>
                                      {fileSources!.map((source, idx) => (
                                        <div
                                          key={`${message.key}-file-${idx}`}
                                          className='inline-flex items-center gap-1.5 rounded-xl border bg-muted/60 px-2.5 py-1.5 text-xs'
                                        >
                                          <span>📎</span>
                                          <span className='max-w-[140px] truncate font-medium'>
                                            {source.title.replace('📎 ', '')}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Reasoning */}
                                  {showReasoning && (
                                    <Reasoning
                                      defaultOpen={true}
                                      isStreaming={message.isReasoningStreaming}
                                    >
                                      <ReasoningTrigger />
                                      <ReasoningContent>
                                        {message.reasoning!.content}
                                      </ReasoningContent>
                                    </Reasoning>
                                  )}

                                  {/* Loader */}
                                  {showLoader && (
                                    <div className='flex items-center gap-2 py-2'>
                                      <Loader />
                                      <Shimmer className='text-sm' duration={1}>
                                        Responding...
                                      </Shimmer>
                                    </div>
                                  )}

                                  {/* Error or Content */}
                                  {message.status === 'error' ? (
                                    <>
                                      <MessageError
                                        message={message}
                                        className='mb-2'
                                      />
                                      {actions}
                                    </>
                                  ) : (
                                    showMessageContent && (
                                      <>
                                        <MessageContent
                                          variant='flat'
                                          className={cn(
                                            getMessageContentStyles()
                                          )}
                                        >
                                          <Response>{displayContent}</Response>
                                        </MessageContent>
                                        {actions}
                                      </>
                                    )
                                  )}
                                </>
                              )
                            })()}
                          </>
                        )}
                      </div>
                    </Message>
                  ))}
                </BranchMessages>

                {/* Branch selector for multiple versions */}
                {versions.length > 1 && (
                  <BranchSelector className='px-0' from={message.from}>
                    <BranchPrevious />
                    <BranchPage />
                    <BranchNext />
                  </BranchSelector>
                )}
              </Branch>
            )
          })}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
