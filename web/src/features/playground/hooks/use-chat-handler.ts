import { useCallback } from 'react'
import { toast } from 'sonner'
import { sendChatCompletion } from '../api'
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import {
  buildChatCompletionPayload,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
  processMessageWithThinkTags,
  finalizeMessageReasoning,
  handleIncompleteThinkTags,
} from '../lib'
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
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

  // Handle stream update
  const handleStreamUpdate = useCallback(
    (type: 'reasoning' | 'content', chunk: string) => {
      onMessageUpdate((prev) =>
        updateLastAssistantMessage(prev, (message) => {
          if (message.status === MESSAGE_STATUS.ERROR) return message

          if (type === 'reasoning') {
            return {
              ...message,
              reasoning: {
                content: (message.reasoning?.content || '') + chunk,
                duration: message.reasoning?.duration || 0,
              },
              isReasoningStreaming: true,
              status: MESSAGE_STATUS.STREAMING,
            }
          }

          // Handle content - extract <think> tags in real-time
          return {
            ...processMessageWithThinkTags(message, chunk),
            status: MESSAGE_STATUS.STREAMING,
          }
        })
      )
    },
    [onMessageUpdate]
  )

  // Handle stream complete
  const handleStreamComplete = useCallback(() => {
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) => {
        if (
          message.status === MESSAGE_STATUS.COMPLETE ||
          message.status === MESSAGE_STATUS.ERROR
        ) {
          return message
        }

        return {
          ...finalizeMessageReasoning(message),
          status: MESSAGE_STATUS.COMPLETE,
        }
      })
    )
  }, [onMessageUpdate])

  // Handle stream error
  const handleStreamError = useCallback(
    (error: string) => {
      toast.error(error)
      onMessageUpdate((prev) => updateAssistantMessageWithError(prev, error))
    },
    [onMessageUpdate]
  )

  // Send streaming chat request
  const sendStreamingChat = useCallback(
    (messages: Message[]) => {
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled
      )

      sendStreamRequest(
        payload,
        handleStreamUpdate,
        handleStreamComplete,
        handleStreamError
      )
    },
    [
      config,
      parameterEnabled,
      sendStreamRequest,
      handleStreamUpdate,
      handleStreamComplete,
      handleStreamError,
    ]
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
          onMessageUpdate((prev) =>
            updateLastAssistantMessage(prev, (message) => ({
              ...finalizeMessageReasoning(
                {
                  ...message,
                  versions: [
                    {
                      ...message.versions[0],
                      content: choice.message?.content || '',
                    },
                  ],
                },
                choice.message?.reasoning_content
              ),
              status: MESSAGE_STATUS.COMPLETE,
            }))
          )
        }
      } catch (error: any) {
        handleStreamError(
          error?.response?.data?.message ||
            error?.message ||
            ERROR_MESSAGES.API_REQUEST_ERROR
        )
      }
    },
    [config, parameterEnabled, onMessageUpdate, handleStreamError]
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

    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) => {
        // Only stop if message is loading or streaming
        if (
          message.status !== MESSAGE_STATUS.LOADING &&
          message.status !== MESSAGE_STATUS.STREAMING
        ) {
          return message
        }

        return {
          ...handleIncompleteThinkTags(message),
          status: MESSAGE_STATUS.COMPLETE,
        }
      })
    )
  }, [stopStream, onMessageUpdate])

  // Check if currently generating
  const isGenerating = isStreaming

  return {
    sendChat,
    stopGeneration,
    isGenerating,
  }
}
