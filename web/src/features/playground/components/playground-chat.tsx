import { cn } from '@/lib/utils'
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
}

export function PlaygroundChat({
  messages,
  onCopyMessage,
  onRegenerateMessage,
  onEditMessage,
  onDeleteMessage,
  isGenerating = false,
}: PlaygroundChatProps) {
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
                      <div className='w-full min-w-0 flex-1 basis-full'>
                        {/* Sources */}
                        {message.sources?.length && (
                          <Sources>
                            <SourcesTrigger count={message.sources.length} />
                            <SourcesContent>
                              {message.sources.map((source, sourceIndex) => (
                                <Source
                                  href={source.href}
                                  key={`${message.key}-source-${sourceIndex}`}
                                  title={source.title}
                                />
                              ))}
                            </SourcesContent>
                          </Sources>
                        )}

                        {/* Reasoning - Only show for assistant with reasoning content */}
                        {message.from === MESSAGE_ROLES.ASSISTANT &&
                          message.reasoning?.content && (
                            <Reasoning
                              defaultOpen={true}
                              isStreaming={message.isReasoningStreaming}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>
                                {message.reasoning.content}
                              </ReasoningContent>
                            </Reasoning>
                          )}

                        {/* Loading indicator - Show when loading or streaming without content */}
                        {message.from === MESSAGE_ROLES.ASSISTANT &&
                          (message.status === 'loading' ||
                            (message.status === 'streaming' &&
                              !version.content)) && (
                            <div className='flex items-center gap-2 py-2'>
                              <Loader />
                              <Shimmer className='text-sm' duration={1}>
                                Responding...
                              </Shimmer>
                            </div>
                          )}

                        {/* Error Alert - Show for error messages */}
                        {message.status === 'error' ? (
                          <>
                            <MessageError message={message} className='mb-2' />
                            {/* Message Actions - Always show for error messages */}
                            <MessageActions
                              message={message}
                              onCopy={onCopyMessage}
                              onRegenerate={onRegenerateMessage}
                              onEdit={onEditMessage}
                              onDelete={onDeleteMessage}
                              isGenerating={isGenerating}
                              alwaysVisible={isLastAssistantMessage}
                              className='mt-2'
                            />
                          </>
                        ) : (
                          /* Message Content - Show when not streaming reasoning or for user messages */
                          (message.from === MESSAGE_ROLES.USER ||
                            !message.isReasoningStreaming) &&
                          version.content && (
                            <>
                              <MessageContent
                                variant='flat'
                                className={cn(getMessageContentStyles())}
                              >
                                <Response>{version.content}</Response>
                              </MessageContent>

                              {/* Message Actions - Show on hover, always visible for last assistant message */}
                              <MessageActions
                                message={message}
                                onCopy={onCopyMessage}
                                onRegenerate={onRegenerateMessage}
                                onEdit={onEditMessage}
                                onDelete={onDeleteMessage}
                                isGenerating={isGenerating}
                                alwaysVisible={isLastAssistantMessage}
                                className='mt-2'
                              />
                            </>
                          )
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
