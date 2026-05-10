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
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { sendPlaygroundRequest } from '../api'
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import {
  buildPlaygroundPayload,
  finalizeMessage,
  inferPlaygroundEndpoint,
  normalizePlaygroundError,
  normalizePlaygroundResponse,
  processStreamingContent,
  updateAssistantMessageWithError,
  updateCurrentVersionContent,
  updateLastAssistantMessage,
} from '../lib'
import { isImageGenerationEndpoint } from '../lib/validation'
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
  const endpoint = useMemo(
    () => config.endpointOverride ?? inferPlaygroundEndpoint(config.model),
    [config.endpointOverride, config.model]
  )

  // Handle stream update
  const handleStreamUpdate = useCallback(
    ({ type, chunk }: { type: 'reasoning' | 'content'; chunk: string }) => {
      onMessageUpdate((prev) =>
        updateLastAssistantMessage(prev, (message) => {
          if (message.status === MESSAGE_STATUS.ERROR) return message

          if (type === 'reasoning') {
            return {
              ...message,
              reasoning: {
                content: (message.reasoning?.content || '') + chunk,
                duration: 0,
              },
              isReasoningStreaming: true,
              status: MESSAGE_STATUS.STREAMING,
            }
          }

          return {
            ...processStreamingContent(message, chunk),
            status: MESSAGE_STATUS.STREAMING,
          }
        })
      )
    },
    [onMessageUpdate]
  )

  // Handle stream complete
  const handleStreamComplete = useCallback(
    (result?: { content?: string; reasoning?: string; images?: Message['images'] }) => {
      onMessageUpdate((prev) =>
        updateLastAssistantMessage(prev, (message) => {
          if (
            message.status === MESSAGE_STATUS.COMPLETE ||
            message.status === MESSAGE_STATUS.ERROR
          ) {
            return message
          }

          const withCompletedContent = result?.content
            ? updateCurrentVersionContent(message, result.content)
            : message
          const finalized = finalizeMessage(
            withCompletedContent,
            result?.reasoning
          )

          return {
            ...finalized,
            images: result?.images?.length ? result.images : finalized.images,
            status: MESSAGE_STATUS.COMPLETE,
          }
        })
      )
    },
    [onMessageUpdate]
  )

  // Handle stream error
  const handleStreamError = useCallback(
    (error: string, errorCode?: string) => {
      toast.error(error)
      onMessageUpdate((prev) =>
        updateAssistantMessageWithError(prev, error, errorCode)
      )
    },
    [onMessageUpdate]
  )

  // Send streaming chat request
  const sendStreamingChat = useCallback(
    (messages: Message[]) => {
      const payload = buildPlaygroundPayload(
        endpoint,
        messages,
        config,
        parameterEnabled
      )
      sendStreamRequest(
        endpoint,
        payload,
        handleStreamUpdate,
        handleStreamComplete,
        handleStreamError
      )
    },
    [
      endpoint,
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
      const payload = buildPlaygroundPayload(
        endpoint,
        messages,
        config,
        parameterEnabled
      )

      try {
        const response = await sendPlaygroundRequest(endpoint, payload)
        const normalized = normalizePlaygroundResponse(endpoint, response)

        onMessageUpdate((prev) =>
          updateLastAssistantMessage(prev, (message) => ({
            ...finalizeMessage(
              updateCurrentVersionContent(message, normalized.content),
              normalized.reasoning
            ),
            images: normalized.images?.length ? normalized.images : message.images,
            status: MESSAGE_STATUS.COMPLETE,
          }))
        )
      } catch (error: unknown) {
        const normalized = normalizePlaygroundError(error)
        handleStreamError(
          normalized.message || ERROR_MESSAGES.API_REQUEST_ERROR,
          normalized.code
        )
      }
    },
    [endpoint, config, parameterEnabled, onMessageUpdate, handleStreamError]
  )

  // Send chat request (stream or non-stream based on config)
  const sendChat = useCallback(
    (messages: Message[]) => {
      if (config.stream && !isImageGenerationEndpoint(endpoint)) {
        sendStreamingChat(messages)
      } else {
        sendNonStreamingChat(messages)
      }
    },
    [config.stream, endpoint, sendStreamingChat, sendNonStreamingChat]
  )

  // Stop generation
  const stopGeneration = useCallback(() => {
    stopStream()
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        message.status === MESSAGE_STATUS.LOADING ||
        message.status === MESSAGE_STATUS.STREAMING
          ? { ...finalizeMessage(message), status: MESSAGE_STATUS.COMPLETE }
          : message
      )
    )
  }, [stopStream, onMessageUpdate])

  return {
    sendChat,
    stopGeneration,
    isGenerating: isStreaming,
  }
}
