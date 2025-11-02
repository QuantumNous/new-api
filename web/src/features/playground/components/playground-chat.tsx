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
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { MESSAGE_ROLES } from '../constants'
import type { Message as MessageType } from '../types'

interface PlaygroundChatProps {
  messages: MessageType[]
}

export function PlaygroundChat({ messages }: PlaygroundChatProps) {
  return (
    <Conversation>
      {/* Remove outer padding; apply padding to inner centered container to align with input */}
      <ConversationContent className='p-0'>
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>
          {messages.map(({ versions = [], ...message }) => (
            <Branch defaultBranch={0} key={message.key}>
              <BranchMessages>
                {versions.map((version, versionIndex) => (
                  <Message
                    className='flex-row-reverse'
                    from={message.from}
                    key={`${message.key}-${version.id}-${versionIndex}`}
                  >
                    <div className='min-w-0 flex-1'>
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

                      {/* Message Content - Show when not streaming reasoning or for user messages */}
                      {(message.from === MESSAGE_ROLES.USER ||
                        !message.isReasoningStreaming) &&
                        version.content && (
                          <MessageContent
                            variant='flat'
                            className={cn(
                              // Assistant content fills the row; user bubble auto-width
                              'group-[.is-assistant]:w-full group-[.is-user]:w-fit',
                              // User bubble: rounded and themed background
                              'group-[.is-user]:text-foreground group-[.is-user]:bg-secondary dark:group-[.is-user]:bg-muted group-[.is-user]:rounded-[24px]',
                              // Assistant bubble: flat serif style (one-sided style)
                              'group-[.is-assistant]:text-foreground group-[.is-assistant]:bg-transparent group-[.is-assistant]:p-0 group-[.is-assistant]:font-serif',
                              // Preferred readable widths and wrapping
                              'leading-relaxed break-keep whitespace-pre-wrap sm:leading-7 sm:break-words',
                              // Cap user bubble width so it does not look like a banner
                              'group-[.is-user]:max-w-[85%] sm:group-[.is-user]:max-w-[62ch] md:group-[.is-user]:max-w-[68ch] lg:group-[.is-user]:max-w-[72ch]'
                            )}
                          >
                            <Response>{version.content}</Response>
                          </MessageContent>
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
          ))}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
