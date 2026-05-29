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
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { getMessageContent, parseThinkTags } from '../lib/message-utils'
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

type MessageContentDisplayProps = {
  actions: ReactNode
  message: MessageType
  versionContent: string
}

function MessageContentDisplay({
  actions,
  message,
  versionContent,
}: MessageContentDisplayProps) {
  const { t } = useTranslation()
  const isAssistant = message.from === MESSAGE_ROLES.ASSISTANT
  const sources = message.sources ?? []
  const reasoningContent = isAssistant ? message.reasoning?.content : undefined
  const hasSources = sources.length > 0
  const hasReasoning = !!reasoningContent
  const showLoader =
    isAssistant &&
    !message.isReasoningStreaming &&
    (message.status === 'loading' ||
      (message.status === 'streaming' && !versionContent))
  const showMessageContent =
    (message.from === MESSAGE_ROLES.USER || !message.isReasoningStreaming) &&
    !!versionContent
  const displayContent = isAssistant
    ? parseThinkTags(versionContent).visibleContent
    : versionContent

  return (
    <>
      {hasSources && (
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source
                href={source.href}
                key={`${source.href}-${source.title}`}
                title={source.title}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {hasReasoning && (
        <Reasoning
          defaultOpen={true}
          isStreaming={message.isReasoningStreaming}
        >
          <ReasoningTrigger />
          <ReasoningContent>{reasoningContent}</ReasoningContent>
        </Reasoning>
      )}

      {showLoader && (
        <div className='flex items-center gap-2 py-2'>
          <Loader />
          <Shimmer className='text-sm' duration={1}>
            {t('Responding...')}
          </Shimmer>
        </div>
      )}

      {message.status === 'error' && (
        <>
          <MessageError message={message} className='mb-2' />
          {actions}
        </>
      )}

      {message.status !== 'error' && showMessageContent && (
        <>
          <MessageContent
            variant='flat'
            className={cn(getMessageContentStyles())}
          >
            <Response>{displayContent}</Response>
          </MessageContent>
          {actions}
        </>
      )}
    </>
  )
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
    const content = message ? getMessageContent(message) : ''
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
            const currentContent = getMessageContent(message)
            const isLastAssistantMessage =
              messageIndex === messages.length - 1 &&
              message.from === MESSAGE_ROLES.ASSISTANT

            return (
              <Message
                className='group flex-row-reverse'
                from={message.from}
                key={message.key}
              >
                <div className='w-full min-w-0 flex-1 basis-full py-1'>
                  {isEditing(message.key) ? (
                    <div className='space-y-2'>
                      <Textarea
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        className='font-mono text-sm'
                        rows={8}
                      />
                      <div className='flex gap-2'>
                        {message.from === MESSAGE_ROLES.USER && (
                          <Button
                            size='sm'
                            onClick={() => onSaveEditAndSubmit?.(editText)}
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
                    <MessageContentDisplay
                      actions={
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
                      }
                      message={message}
                      versionContent={currentContent}
                    />
                  )}
                </div>
              </Message>
            )
          })}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
