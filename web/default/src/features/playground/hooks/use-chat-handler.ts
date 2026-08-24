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
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
  minimalParameters?: boolean
}

type ChatConfigOverride = Partial<Pick<PlaygroundConfig, 'model' | 'group'>>

interface ChatRequestGate {
  current: boolean
}

function beginChatRequest(
  gate: ChatRequestGate,
  setBusy: (busy: boolean) => void
): boolean {
  if (gate.current) return false
  gate.current = true
  setBusy(true)
  return true
}

function finishChatRequest(
  gate: ChatRequestGate,
  setBusy: (busy: boolean) => void
): void {
  if (!gate.current) return
  gate.current = false
  setBusy(false)
}

export async function runSingleChatRequest(
  gate: ChatRequestGate,
  setBusy: (busy: boolean) => void,
  request: () => Promise<void>
): Promise<boolean> {
  if (!beginChatRequest(gate, setBusy)) return false
  try {
    await request()
    return true
  } finally {
    finishChatRequest(gate, setBusy)
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
  const requestGateRef = useRef(false)
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
      if (!beginChatRequest(requestGateRef, setIsRequestGenerating)) return
      try {
        sendStreamRequest(
          payload,
          handleStreamUpdate,
          () => {
            handleStreamComplete()
            finishChatRequest(requestGateRef, setIsRequestGenerating)
          },
          (error, errorCode) => {
            handleStreamError(error, errorCode)
            finishChatRequest(requestGateRef, setIsRequestGenerating)
          }
        )
      } catch (error) {
        finishChatRequest(requestGateRef, setIsRequestGenerating)
        throw error
      }
    },
    [
      config,
      parameterEnabled,
      minimalParameters,
      sendStreamRequest,
      handleStreamUpdate,
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
        requestGateRef,
        setIsRequestGenerating,
        async () => {
          const controller = new AbortController()
          nonStreamingAbortRef.current = controller
          try {
            const response = await sendChatCompletion(
              payload,
              controller.signal
            )
            if (controller.signal.aborted) return
            const choice = response.choices?.[0]
            if (!choice) return

            onMessageUpdate((prev) =>
              updateLastAssistantMessage(prev, (message) => ({
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
              }))
            )
          } catch (error: unknown) {
            if (controller.signal.aborted) return
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
    stopStream()
    nonStreamingAbortRef.current?.abort()
    nonStreamingAbortRef.current = null
    finishChatRequest(requestGateRef, setIsRequestGenerating)
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
