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
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { sendChatCompletion } from '../api'
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import {
  buildChatCompletionPayload,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
  processStreamingContent,
  finalizeMessage,
} from '../lib'
import type {
  ChatCompletionResponse,
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundResponseMetadata,
} from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
  minimalParameters?: boolean
}

type ChatConfigOverride = Partial<Pick<PlaygroundConfig, 'model' | 'group'>>

export interface ChatRequestGate {
  current: number | null
  next: number
}

function beginChatRequest(
  gate: ChatRequestGate,
  setBusy: (busy: boolean) => void
): number | null {
  if (gate.current !== null) return null
  gate.next += 1
  gate.current = gate.next
  setBusy(true)
  return gate.current
}

function finishChatRequest(
  gate: ChatRequestGate,
  requestId: number,
  setBusy: (busy: boolean) => void
): void {
  if (gate.current !== requestId) return
  gate.current = null
  setBusy(false)
}

function isCurrentChatRequest(
  gate: ChatRequestGate,
  requestId: number
): boolean {
  return gate.current === requestId
}

export function cancelChatRequest(
  gate: ChatRequestGate,
  setBusy: (busy: boolean) => void
): void {
  if (gate.current === null) return
  gate.current = null
  setBusy(false)
}

export async function runSingleChatRequest(
  gate: ChatRequestGate,
  setBusy: (busy: boolean) => void,
  request: (requestId: number) => Promise<void>
): Promise<boolean> {
  const requestId = beginChatRequest(gate, setBusy)
  if (requestId === null) return false
  try {
    await request(requestId)
    return true
  } finally {
    finishChatRequest(gate, requestId, setBusy)
  }
}

function responseMetadataFromCompletion(
  response: ChatCompletionResponse
): PlaygroundResponseMetadata {
  return {
    relayRequestId: response.id || undefined,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
  }
}

export function applyChatCompletionResponse(
  message: Message,
  response: ChatCompletionResponse
): Message {
  const choice = response.choices?.[0]
  if (!choice) return message

  return {
    ...finalizeMessage(
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
    responseMetadata: responseMetadataFromCompletion(response),
  }
}

/**
 * Hook for handling chat message sending and receiving
 */
export function useChatHandler({
  config,
  parameterEnabled,
  onMessageUpdate,
  minimalParameters = false,
}: UseChatHandlerOptions) {
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const requestGateRef = useRef<ChatRequestGate>({ current: null, next: 0 })
  const nonStreamingAbortRef = useRef<AbortController | null>(null)
  const [isRequestGenerating, setIsRequestGenerating] = useState(false)

  // Handle stream update
  const handleStreamUpdate = useCallback(
    (type: 'reasoning' | 'content', chunk: string) => {
      onMessageUpdate((prev) =>
        updateLastAssistantMessage(prev, (message) => {
          if (message.status === MESSAGE_STATUS.ERROR) return message

          if (type === 'reasoning') {
            // Direct API reasoning_content
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

          // Content streaming: handle <think> tags
          return {
            ...processStreamingContent(message, chunk),
            status: MESSAGE_STATUS.STREAMING,
          }
        })
      )
    },
    [onMessageUpdate]
  )

  const handleStreamMetadata = useCallback(
    (metadata: PlaygroundResponseMetadata) => {
      onMessageUpdate((prev) =>
        updateLastAssistantMessage(prev, (message) => ({
          ...message,
          responseMetadata: {
            ...message.responseMetadata,
            ...metadata,
          },
        }))
      )
    },
    [onMessageUpdate]
  )

  // Handle stream complete
  const handleStreamComplete = useCallback(() => {
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        message.status === MESSAGE_STATUS.COMPLETE ||
        message.status === MESSAGE_STATUS.ERROR
          ? message
          : { ...finalizeMessage(message), status: MESSAGE_STATUS.COMPLETE }
      )
    )
  }, [onMessageUpdate])

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
    (messages: Message[], configOverride?: ChatConfigOverride) => {
      const requestConfig = { ...config, ...configOverride }
      const payload = buildChatCompletionPayload(
        messages,
        requestConfig,
        parameterEnabled,
        { minimalParameters }
      )
      const requestId = beginChatRequest(
        requestGateRef.current,
        setIsRequestGenerating
      )
      if (requestId === null) return
      try {
        sendStreamRequest(
          payload,
          (type, chunk) => {
            if (!isCurrentChatRequest(requestGateRef.current, requestId)) return
            handleStreamUpdate(type, chunk)
          },
          (metadata) => {
            if (!isCurrentChatRequest(requestGateRef.current, requestId)) return
            handleStreamMetadata(metadata)
          },
          () => {
            if (!isCurrentChatRequest(requestGateRef.current, requestId)) return
            handleStreamComplete()
            finishChatRequest(
              requestGateRef.current,
              requestId,
              setIsRequestGenerating
            )
          },
          (error, errorCode) => {
            if (!isCurrentChatRequest(requestGateRef.current, requestId)) return
            handleStreamError(error, errorCode)
            finishChatRequest(
              requestGateRef.current,
              requestId,
              setIsRequestGenerating
            )
          }
        )
      } catch (error) {
        finishChatRequest(
          requestGateRef.current,
          requestId,
          setIsRequestGenerating
        )
        throw error
      }
    },
    [
      config,
      parameterEnabled,
      minimalParameters,
      sendStreamRequest,
      handleStreamUpdate,
      handleStreamMetadata,
      handleStreamComplete,
      handleStreamError,
    ]
  )

  // Send non-streaming chat request
  const sendNonStreamingChat = useCallback(
    async (messages: Message[], configOverride?: ChatConfigOverride) => {
      const requestConfig = { ...config, ...configOverride }
      const payload = buildChatCompletionPayload(
        messages,
        requestConfig,
        parameterEnabled,
        { minimalParameters }
      )

      await runSingleChatRequest(
        requestGateRef.current,
        setIsRequestGenerating,
        async (requestId) => {
          const controller = new AbortController()
          nonStreamingAbortRef.current = controller
          try {
            const response = await sendChatCompletion(
              payload,
              controller.signal
            )
            if (
              controller.signal.aborted ||
              !isCurrentChatRequest(requestGateRef.current, requestId)
            ) {
              return
            }
            onMessageUpdate((prev) =>
              updateLastAssistantMessage(prev, (message) =>
                applyChatCompletionResponse(message, response)
              )
            )
          } catch (error: unknown) {
            if (
              controller.signal.aborted ||
              !isCurrentChatRequest(requestGateRef.current, requestId)
            ) {
              return
            }
            const err = error as {
              response?: {
                data?: { message?: string; error?: { code?: string } }
              }
              message?: string
            }
            handleStreamError(
              err?.response?.data?.message ||
                err?.message ||
                ERROR_MESSAGES.API_REQUEST_ERROR,
              err?.response?.data?.error?.code || undefined
            )
          } finally {
            if (nonStreamingAbortRef.current === controller) {
              nonStreamingAbortRef.current = null
            }
          }
        }
      )
    },
    [
      config,
      parameterEnabled,
      minimalParameters,
      onMessageUpdate,
      handleStreamError,
    ]
  )

  // Send chat request (stream or non-stream based on config)
  const sendChat = useCallback(
    (messages: Message[], configOverride?: ChatConfigOverride) => {
      if (config.stream) {
        sendStreamingChat(messages, configOverride)
      } else {
        sendNonStreamingChat(messages, configOverride)
      }
    },
    [config.stream, sendStreamingChat, sendNonStreamingChat]
  )

  // Stop generation
  const stopGeneration = useCallback(() => {
    cancelChatRequest(requestGateRef.current, setIsRequestGenerating)
    stopStream()
    nonStreamingAbortRef.current?.abort()
    nonStreamingAbortRef.current = null
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
    isGenerating: isRequestGenerating,
  }
}
