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
                    from={message.from}
                    key={`${message.key}-${version.id}-${versionIndex}`}
                  >
                    <div className='min-w-0'>
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
                            className={cn(
                              // User bubble: rounded and colored
                              'group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:rounded-[24px]',
                              // Assistant bubble: flat style
                              'group-[.is-assistant]:text-foreground group-[.is-assistant]:bg-transparent group-[.is-assistant]:p-0',
                              // Width & wrapping: follow chat best practices (~45–75 chars/line)
                              // Mobile: keep-all for CJK; Desktop: allow word-wrapping for long tokens
                              'max-w-[95%] leading-relaxed break-keep whitespace-pre-wrap sm:max-w-[62ch] sm:leading-7 sm:break-words md:max-w-[68ch] lg:max-w-[72ch]',
                              // Avoid ultra-narrow bubbles for very short messages while staying subtle
                              'min-w-[4ch]'
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
