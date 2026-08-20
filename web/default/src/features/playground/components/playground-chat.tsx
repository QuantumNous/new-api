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
import { useTranslation } from 'react-i18next'
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
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { MESSAGE_ROLES } from '../constants'
import { getMessageContentStyles } from '../lib/message-styles'
import {
  parseThinkTags,
  splitGeneratedImageMarkdown,
} from '../lib/message-utils'
import type { Message as MessageType } from '../types'
import { MessageActions } from './message-actions'
import { MessageError } from './message-error'

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
  const { t } = useTranslation()
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
            const isLastAssistantMessage =
              messageIndex === messages.length - 1 &&
              message.from === MESSAGE_ROLES.ASSISTANT
            return (
              <Branch defaultBranch={0} key={message.key}>
                <BranchMessages>
                  {versions.map((version, versionIndex) => (
                    <Message
                      className='group flex-row-reverse'
                      from={message.from}
                      key={`${message.key}-${version.id}-${versionIndex}`}
                    >
                      <div className='w-full min-w-0 flex-1 basis-full py-1'>
                        {isEditing(message.key) ? (
                          <div className='space-y-2'>
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className='font-mono text-sm'
                              rows={8}
                            />
                            <div className='flex gap-2'>
                              {/* Save & Submit only makes sense for user messages */}
                              {message.from === MESSAGE_ROLES.USER && (
                                <Button
                                  size='sm'
                                  onClick={() =>
                                    onSaveEditAndSubmit?.(editText)
                                  }
                                  disabled={isEmpty || !isChanged}
                                >
                                  {t('Save & Submit')}
                                </Button>
                              )}
                              <Button
                                size='sm'
                                onClick={() => onSaveEdit?.(editText)}
                                disabled={isEmpty || !isChanged}
                              >
                                {t('Save')}
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => onCancelEdit?.(false)}
                              >
                                {t('Cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const isAssistant =
                                message.from === MESSAGE_ROLES.ASSISTANT
                              const hasSources = !!message.sources?.length
                              const showReasoning =
                                isAssistant && !!message.reasoning?.content
                              const showLoader =
                                isAssistant &&
                                !message.isReasoningStreaming &&
                                (message.status === 'loading' ||
                                  (message.status === 'streaming' &&
                                    !version.content))
                              const showMessageContent =
                                (message.from === MESSAGE_ROLES.USER ||
                                  !message.isReasoningStreaming) &&
                                (!!version.content ||
                                  !!message.generatedMedia?.length)

                              // Extract visible content (remove <think> tags for assistant messages)
                              const displayContent = isAssistant
                                ? parseThinkTags(version.content).visibleContent
                                : version.content
                              const generatedImageContent = isAssistant
                                ? splitGeneratedImageMarkdown(displayContent)
                                : {
                                    text: displayContent,
                                    images: [],
                                    hasPendingImage: false,
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
                                  downloads={[
                                    ...generatedImageContent.images.map(
                                      (image) => ({
                                        href: image.src,
                                        fileName: image.downloadName,
                                      })
                                    ),
                                    ...(message.generatedMedia ?? [])
                                      .filter((media) => media.type === 'image')
                                      .map((media, mediaIndex) => ({
                                        href: media.url,
                                        fileName: `generated-image-${mediaIndex + 1}.png`,
                                      })),
                                  ]}
                                />
                              )

                              // Video-generation messages render their own way:
                              // an error alert on failure, an inline <video> once
                              // the blob object URL is ready, or a progress
                              // spinner while the async task is still running.
                              if (message.isVideo) {
                                if (message.status === 'error') {
                                  return (
                                    <>
                                      <MessageError
                                        message={message}
                                        className='mb-2'
                                      />
                                      {actions}
                                    </>
                                  )
                                }
                                if (message.videoUrl) {
                                  return (
                                    <>
                                      <video
                                        src={message.videoUrl}
                                        controls
                                        className='max-w-full rounded-lg'
                                      />
                                      {actions}
                                    </>
                                  )
                                }
                                return (
                                  <div className='flex items-center gap-2 py-2'>
                                    <Loader />
                                    <Shimmer className='text-sm' duration={1}>
                                      {message.videoProgress
                                        ? t('Generating video… {{progress}}%', {
                                            progress: message.videoProgress,
                                          })
                                        : t('Generating video…')}
                                    </Shimmer>
                                  </div>
                                )
                              }

                              return (
                                <>
                                  {/* Sources */}
                                  {hasSources && (
                                    <Sources>
                                      <SourcesTrigger
                                        count={message.sources!.length}
                                      />
                                      <SourcesContent>
                                        {message.sources!.map(
                                          (source, sourceIndex) => (
                                            <Source
                                              href={source.href}
                                              key={`${message.key}-source-${sourceIndex}`}
                                              title={source.title}
                                            />
                                          )
                                        )}
                                      </SourcesContent>
                                    </Sources>
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
                                        {t('Responding...')}
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
                                          <div className='space-y-3'>
                                            {!!message.generatedMedia
                                              ?.length && (
                                              <div className='grid gap-3 sm:grid-cols-2'>
                                                {message.generatedMedia.map(
                                                  (media, mediaIndex) => {
                                                    if (
                                                      media.type === 'video'
                                                    ) {
                                                      return (
                                                        <video
                                                          className='bg-muted max-h-[32rem] w-full rounded-xl object-contain'
                                                          controls
                                                          key={`${message.key}-video-${mediaIndex}`}
                                                          preload='metadata'
                                                          src={media.url}
                                                        >
                                                          {t(
                                                            'Your browser does not support video playback.'
                                                          )}
                                                        </video>
                                                      )
                                                    }
                                                    return (
                                                      <img
                                                        alt={t(
                                                          'Generated image'
                                                        )}
                                                        className='bg-muted max-h-[32rem] w-full rounded-xl object-contain'
                                                        key={`${message.key}-image-${mediaIndex}`}
                                                        loading='lazy'
                                                        src={media.url}
                                                      />
                                                    )
                                                  }
                                                )}
                                              </div>
                                            )}
                                            {generatedImageContent.text && (
                                              <Response>
                                                {generatedImageContent.text}
                                              </Response>
                                            )}
                                            {generatedImageContent.images.map(
                                              (image, imageIndex) => (
                                                <div
                                                  key={`${message.key}-${version.id}-generated-image-${imageIndex}`}
                                                >
                                                  <img
                                                    alt={
                                                      image.alt ||
                                                      t('Generated image')
                                                    }
                                                    className='h-auto max-w-full rounded-lg'
                                                    decoding='async'
                                                    src={image.src}
                                                  />
                                                </div>
                                              )
                                            )}
                                            {generatedImageContent.hasPendingImage && (
                                              <div className='flex items-center gap-2 py-2'>
                                                <Loader />
                                                <Shimmer
                                                  className='text-sm'
                                                  duration={1}
                                                >
                                                  {t('Responding...')}
                                                </Shimmer>
                                              </div>
                                            )}
                                          </div>
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
