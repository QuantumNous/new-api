import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { sendChatCompletion } from '../api'
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import { buildChatCompletionPayload } from '../lib'
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

/**
 * Extract and remove <think> tags from content, move to reasoning
 */
function extractThinkTags(content: string): {
  cleanContent: string
  thinkingContent: string
} {
  if (!content.includes('<think>')) {
    return { cleanContent: content, thinkingContent: '' }
  }

  const thinkRegex = /<think>([\s\S]*?)<\/think>/g
  const thoughts: string[] = []
  let cleanContent = content

  let match
  while ((match = thinkRegex.exec(content)) !== null) {
    thoughts.push(match[1].trim())
  }

  // Remove all think tags from content
  cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  return {
    cleanContent,
    thinkingContent: thoughts.join('\n\n'),
  }
}

/**
 * Update assistant message with error
 */
function updateAssistantMessageError(
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void,
  errorMessage: string
) {
  onMessageUpdate((prev) => {
    const last = prev[prev.length - 1]
    if (!last || last.from !== 'assistant') return prev

    const updated = [...prev]
    const lastMessage = { ...last }

    lastMessage.status = MESSAGE_STATUS.ERROR
    lastMessage.versions = [
      {
        ...lastMessage.versions[0],
        content: `${ERROR_MESSAGES.API_REQUEST_ERROR}: ${errorMessage}`,
      },
    ]
    lastMessage.isReasoningStreaming = false

    updated[updated.length - 1] = lastMessage
    return updated
  })
}

/**
 * Hook for handling chat message sending and receiving
 */
export function useChatHandler({
  config,
  parameterEnabled,
  onMessageUpdate,
}: UseChatHandlerOptions) {
  const { sendStreamRequest, stopStream, isStreaming } = useStreamRequest()

  // Send streaming chat request
  const sendStreamingChat = useCallback(
    (messages: Message[]) => {
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled
      )

      const onUpdate = (type: 'reasoning' | 'content', chunk: string) => {
        onMessageUpdate((prev) => {
          const last = prev[prev.length - 1]
          if (!last || last.from !== 'assistant') return prev
          if (last.status === MESSAGE_STATUS.ERROR) return prev

          const updated = [...prev]
          const lastMessage = { ...last }

          if (type === 'reasoning') {
            // Handle reasoning_content from backend (native field)
            if (!lastMessage.reasoning) {
              lastMessage.reasoning = { content: '', duration: 0 }
            }
            lastMessage.reasoning.content += chunk
            lastMessage.isReasoningStreaming = true
            lastMessage.status = MESSAGE_STATUS.STREAMING
          } else if (type === 'content') {
            // Handle regular content - extract <think> tags in real-time
            const currentVersion = lastMessage.versions[0] || {
              id: 'default',
              content: '',
            }
            const newContent = currentVersion.content + chunk

            // Extract <think> tags from accumulated content in real-time
            const { cleanContent, thinkingContent } =
              extractThinkTags(newContent)

            // Update content (always show clean content without tags)
            lastMessage.versions = [
              {
                ...currentVersion,
                content: cleanContent,
              },
            ]
            lastMessage.status = MESSAGE_STATUS.STREAMING

            // If <think> tags found, move to reasoning
            if (thinkingContent) {
              if (!lastMessage.reasoning) {
                lastMessage.reasoning = { content: '', duration: 0 }
              }
              // Update reasoning content with extracted thinking
              lastMessage.reasoning.content = thinkingContent
              lastMessage.isReasoningStreaming = true
            } else {
              // Mark reasoning as complete when content starts (no more think tags)
              if (
                lastMessage.reasoning &&
                lastMessage.isReasoningStreaming &&
                cleanContent
              ) {
                lastMessage.isReasoningStreaming = false
              }
            }
          }

          updated[updated.length - 1] = lastMessage
          return updated
        })
      }

      const onComplete = () => {
        onMessageUpdate((prev) => {
          const last = prev[prev.length - 1]
          if (!last || last.from !== 'assistant') return prev
          if (
            last.status === MESSAGE_STATUS.COMPLETE ||
            last.status === MESSAGE_STATUS.ERROR
          ) {
            return prev
          }

          const updated = [...prev]
          const lastMessage = { ...last }

          // Extract any <think> tags from content and move to reasoning
          const currentContent = lastMessage.versions[0]?.content || ''
          const { cleanContent, thinkingContent } =
            extractThinkTags(currentContent)

          // Update content without think tags
          lastMessage.versions = [
            { ...lastMessage.versions[0], content: cleanContent },
          ]

          // Merge thinking content with existing reasoning if any
          if (thinkingContent) {
            const existingReasoning = lastMessage.reasoning?.content || ''
            const combinedReasoning = existingReasoning
              ? `${existingReasoning}\n\n${thinkingContent}`
              : thinkingContent

            lastMessage.reasoning = {
              content: combinedReasoning,
              duration: lastMessage.reasoning?.duration || 0,
            }
          }

          lastMessage.status = MESSAGE_STATUS.COMPLETE
          lastMessage.isReasoningStreaming = false

          updated[updated.length - 1] = lastMessage
          return updated
        })
      }

      const onError = (error: string) => {
        toast.error(error)
        updateAssistantMessageError(onMessageUpdate, error)
      }

      sendStreamRequest(payload, onUpdate, onComplete, onError)
    },
    [config, parameterEnabled, sendStreamRequest, onMessageUpdate]
  )

  // Send non-streaming chat request
  const sendNonStreamingChat = useCallback(
    async (messages: Message[]) => {
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled
      )

      try {
        const response = await sendChatCompletion(payload)
        const choice = response.choices?.[0]

        if (choice) {
          onMessageUpdate((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.from !== 'assistant') return prev

            const updated = [...prev]
            const lastMessage = { ...last }

            // Extract content and reasoning
            const rawContent = choice.message?.content || ''
            const reasoningContent = choice.message?.reasoning_content || ''
            const { cleanContent, thinkingContent } =
              extractThinkTags(rawContent)

            // Set clean content
            lastMessage.versions = [
              { ...lastMessage.versions[0], content: cleanContent },
            ]

            // Set reasoning (prefer reasoning_content, fallback to think tags)
            const finalReasoning = reasoningContent || thinkingContent
            if (finalReasoning) {
              lastMessage.reasoning = {
                content: finalReasoning,
                duration: 0,
              }
            }

            lastMessage.status = MESSAGE_STATUS.COMPLETE
            lastMessage.isReasoningStreaming = false

            updated[updated.length - 1] = lastMessage
            return updated
          })
        }
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          ERROR_MESSAGES.API_REQUEST_ERROR
        toast.error(errorMessage)
        updateAssistantMessageError(onMessageUpdate, errorMessage)
      }
    },
    [config, parameterEnabled, onMessageUpdate]
  )

  // Send chat request (stream or non-stream based on config)
  const sendChat = useCallback(
    (messages: Message[]) => {
      if (config.stream) {
        sendStreamingChat(messages)
      } else {
        sendNonStreamingChat(messages)
      }
    },
    [config.stream, sendStreamingChat, sendNonStreamingChat]
  )

  // Stop generation
  const stopGeneration = useCallback(() => {
    stopStream()

    onMessageUpdate((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]

      if (
        !last ||
        last.from !== 'assistant' ||
        (last.status !== MESSAGE_STATUS.LOADING &&
          last.status !== MESSAGE_STATUS.STREAMING)
      ) {
        return prev
      }

      const updated = [...prev]
      const lastMessage = { ...last }

      // Extract any incomplete think tags from content
      const currentContent = lastMessage.versions[0]?.content || ''
      const { cleanContent, thinkingContent } = extractThinkTags(currentContent)

      // Update content without think tags
      lastMessage.versions = [
        { ...lastMessage.versions[0], content: cleanContent },
      ]

      // Handle incomplete thinking content
      if (thinkingContent || currentContent.includes('<think>')) {
        const existingReasoning = lastMessage.reasoning?.content || ''

        // Handle incomplete <think> tag
        const lastThinkIndex = currentContent.lastIndexOf('<think>')
        const hasUnclosedThink =
          lastThinkIndex !== -1 &&
          !currentContent.substring(lastThinkIndex).includes('</think>')

        if (hasUnclosedThink) {
          const unclosedContent = currentContent
            .substring(lastThinkIndex + 7)
            .trim()
          const combinedReasoning = existingReasoning
            ? `${existingReasoning}\n\n${unclosedContent}`
            : unclosedContent

          lastMessage.reasoning = {
            content: combinedReasoning,
            duration: lastMessage.reasoning?.duration || 0,
          }

          // Remove unclosed think tag from content
          lastMessage.versions = [
            {
              ...lastMessage.versions[0],
              content: currentContent.substring(0, lastThinkIndex).trim(),
            },
          ]
        } else if (thinkingContent && !existingReasoning) {
          lastMessage.reasoning = {
            content: thinkingContent,
            duration: lastMessage.reasoning?.duration || 0,
          }
        }
      }

      lastMessage.status = MESSAGE_STATUS.COMPLETE
      lastMessage.isReasoningStreaming = false

      updated[updated.length - 1] = lastMessage
      return updated
    })
  }, [stopStream, onMessageUpdate])

  // Check if currently generating
  const isGenerating = useMemo(() => isStreaming(), [isStreaming])

  return {
    sendChat,
    stopGeneration,
    isGenerating,
  }
}
