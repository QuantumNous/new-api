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
                        {/* Compute and render sections without duplication */}
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
                            !!version.content

                          const actions = (
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
                          )

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
                                      className={cn(getMessageContentStyles())}
                                    >
                                      <Response>{version.content}</Response>
                                    </MessageContent>
                                    {actions}
                                  </>
                                )
                              )}
                            </>
                          )
                        })()}
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
