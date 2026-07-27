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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sendChatCompletion } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  applyStreamingChunk,
  buildChatCompletionPayload,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
  parseRequestErrorDetails,
  applyChatCompletionResponse,
  completeAssistantMessage,
  hasChatCompletionChoice,
  isAssistantMessageFinal,
  isAssistantMessagePending,
} from '../lib'
import { hydrateMessageAttachments } from '../lib/attachments/attachment-assets'
import {
  hasNativeFilePart,
  isChatCompletionPayloadTooLarge,
  type BuildChatPayloadOptions,
} from '../lib/streaming/payload-builder'
import type { StreamMessageUpdate } from '../lib/streaming/stream-utils'
import type {
  ChatCompletionRequest,
  Message,
  MessageTokenUsage,
  PlaygroundConfig,
  ParameterEnabled,
} from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
  /** Optional workbench chat tool preferences applied to request payload */
  payloadOptions?: BuildChatPayloadOptions
}

const KNOWN_ERROR_MESSAGES = new Set<string>(Object.values(ERROR_MESSAGES))
const STREAM_UPDATE_FLUSH_MS = 50

type PendingStreamChunks = {
  content: string
  reasoning: string
  usage?: MessageTokenUsage
}

function mergePendingStreamChunk(
  currentChunk: string,
  nextChunk: string
): string {
  if (!currentChunk || !nextChunk.startsWith(currentChunk)) {
    return currentChunk + nextChunk
  }

  return nextChunk
}

/**
 * Hook for handling chat message sending and receiving
 */
export function useChatHandler({
  config,
  parameterEnabled,
  onMessageUpdate,
  payloadOptions,
}: UseChatHandlerOptions) {
  const { t } = useTranslation()
  const { sendStreamRequest, stopStream, isStreaming } = useStreamRequest()
  const [isRequesting, setIsRequesting] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const pendingStreamChunksRef = useRef<PendingStreamChunks>({
    content: '',
    reasoning: '',
  })
  const streamFlushTimerRef = useRef<number | null>(null)
  const textOnlyRetryRef = useRef<(() => void) | null>(null)
  const receivedContentRef = useRef(false)

  const flushStreamUpdates = useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current)
      streamFlushTimerRef.current = null
    }

    const pendingChunks = pendingStreamChunksRef.current
    if (
      !pendingChunks.reasoning &&
      !pendingChunks.content &&
      !pendingChunks.usage
    ) {
      return
    }

    pendingStreamChunksRef.current = { content: '', reasoning: '' }
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) => {
        let updatedMessage = message

        if (pendingChunks.reasoning) {
          updatedMessage = applyStreamingChunk(
            updatedMessage,
            'reasoning',
            pendingChunks.reasoning
          )
        }

        if (pendingChunks.content) {
          updatedMessage = applyStreamingChunk(
            updatedMessage,
            'content',
            pendingChunks.content
          )
        }

        if (pendingChunks.usage) {
          updatedMessage = { ...updatedMessage, usage: pendingChunks.usage }
        }

        return updatedMessage
      })
    )
  }, [onMessageUpdate])

  const scheduleStreamFlush = useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      return
    }

    streamFlushTimerRef.current = window.setTimeout(
      flushStreamUpdates,
      STREAM_UPDATE_FLUSH_MS
    )
  }, [flushStreamUpdates])

  useEffect(
    () => () => {
      if (streamFlushTimerRef.current !== null) {
        window.clearTimeout(streamFlushTimerRef.current)
      }
    },
    []
  )

  const getDisplayError = useCallback(
    (error: string) => {
      if (KNOWN_ERROR_MESSAGES.has(error)) {
        return t(error)
      }

      const connectionClosedSuffix = `: ${ERROR_MESSAGES.CONNECTION_CLOSED}`
      if (error.endsWith(connectionClosedSuffix)) {
        return `${error.slice(0, -ERROR_MESSAGES.CONNECTION_CLOSED.length)}${t(
          ERROR_MESSAGES.CONNECTION_CLOSED
        )}`
      }

      return error
    },
    [t]
  )

  // Handle stream update
  const handleStreamUpdate = useCallback(
    (update: StreamMessageUpdate) => {
      receivedContentRef.current = true
      if (update.type === 'usage') {
        pendingStreamChunksRef.current.usage = update.usage
      } else {
        pendingStreamChunksRef.current[update.type] = mergePendingStreamChunk(
          pendingStreamChunksRef.current[update.type],
          update.chunk
        )
      }
      scheduleStreamFlush()
    },
    [scheduleStreamFlush]
  )

  // Handle stream complete
  const handleStreamComplete = useCallback(() => {
    flushStreamUpdates()
    setIsRequesting(false)
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        isAssistantMessageFinal(message)
          ? message
          : completeAssistantMessage(message)
      )
    )
  }, [flushStreamUpdates, onMessageUpdate])

  // Handle stream error
  const handleStreamError = useCallback(
    (error: string, errorCode?: string) => {
      const textOnlyRetry = textOnlyRetryRef.current
      textOnlyRetryRef.current = null
      // An upstream that rejects the native document part fails before any
      // token arrives, so resending the extracted text costs nothing and turns
      // an outdated capability flag into a working answer.
      if (textOnlyRetry && !receivedContentRef.current) {
        textOnlyRetry()
        return
      }

      flushStreamUpdates()
      setIsRequesting(false)
      const displayError = getDisplayError(error)
      toast.error(displayError)
      const errorTitle = t(ERROR_MESSAGES.API_REQUEST_ERROR)
      onMessageUpdate((prev) =>
        updateAssistantMessageWithError(
          prev,
          displayError,
          errorCode,
          errorTitle
        )
      )
    },
    [flushStreamUpdates, getDisplayError, onMessageUpdate, t]
  )

  const buildValidatedPayload = useCallback(
    (messages: Message[], nativeFileInput?: boolean) => {
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled,
        nativeFileInput === undefined
          ? payloadOptions
          : { ...payloadOptions, nativeFileInput }
      )

      if (isChatCompletionPayloadTooLarge(payload)) {
        handleStreamError(ERROR_MESSAGES.REQUEST_TOO_LARGE)
        return null
      }

      return payload
    },
    [config, handleStreamError, parameterEnabled, payloadOptions]
  )

  /**
   * Arms the text-only retry for payloads that carry a native document part,
   * so a model whose metadata overstates its document support still answers.
   */
  const armTextOnlyRetry = useCallback(
    (
      payload: ChatCompletionRequest,
      messages: Message[],
      resend: (payload: ChatCompletionRequest) => void
    ) => {
      receivedContentRef.current = false
      if (!hasNativeFilePart(payload)) {
        textOnlyRetryRef.current = null
        return
      }
      textOnlyRetryRef.current = () => {
        const fallback = buildValidatedPayload(messages, false)
        if (fallback) resend(fallback)
      }
    },
    [buildValidatedPayload]
  )

  // Send streaming chat request
  const sendStreamingChat = useCallback(
    async (messages: Message[]) => {
      const hydrated = await hydrateMessageAttachments(
        messages,
        payloadOptions?.nativeFileInput
      )
      const payload = buildValidatedPayload(hydrated)
      if (!payload) return

      const startStream = (request: ChatCompletionRequest) => {
        setIsRequesting(true)
        sendStreamRequest(
          request,
          handleStreamUpdate,
          handleStreamComplete,
          handleStreamError
        )
      }

      armTextOnlyRetry(payload, hydrated, startStream)
      startStream(payload)
    },
    [
      armTextOnlyRetry,
      buildValidatedPayload,
      payloadOptions?.nativeFileInput,
      sendStreamRequest,
      handleStreamUpdate,
      handleStreamComplete,
      handleStreamError,
    ]
  )

  const requestCompletion = useCallback(
    async (payload: ChatCompletionRequest) => {
      const requestId = requestIdRef.current + 1
      const abortController = new AbortController()

      requestIdRef.current = requestId
      abortControllerRef.current = abortController

      try {
        setIsRequesting(true)
        const response = await sendChatCompletion(
          payload,
          abortController.signal
        )
        if (abortController.signal.aborted) return

        if (!hasChatCompletionChoice(response)) {
          handleStreamError(ERROR_MESSAGES.API_REQUEST_ERROR)
          return
        }

        onMessageUpdate((prev) =>
          updateLastAssistantMessage(prev, (message) => {
            const updatedMessage = applyChatCompletionResponse(
              message,
              response
            )

            return updatedMessage ?? message
          })
        )
      } catch (error: unknown) {
        if (abortController.signal.aborted) return

        const { errorCode, errorMessage } = parseRequestErrorDetails(error)
        handleStreamError(errorMessage, errorCode)
      } finally {
        if (requestIdRef.current === requestId) {
          abortControllerRef.current = null
          setIsRequesting(false)
        }
      }
    },
    [handleStreamError, onMessageUpdate]
  )

  // Send non-streaming chat request
  const sendNonStreamingChat = useCallback(
    async (messages: Message[]) => {
      const hydrated = await hydrateMessageAttachments(
        messages,
        payloadOptions?.nativeFileInput
      )
      const payload = buildValidatedPayload(hydrated)
      if (!payload) return

      armTextOnlyRetry(payload, hydrated, (request) => {
        void requestCompletion(request)
      })
      await requestCompletion(payload)
    },
    [
      armTextOnlyRetry,
      buildValidatedPayload,
      payloadOptions?.nativeFileInput,
      requestCompletion,
    ]
  )

  // Send chat request (stream or non-stream based on config)
  const sendChat = useCallback(
    (messages: Message[]) => {
      if (config.stream) {
        void sendStreamingChat(messages)
      } else {
        void sendNonStreamingChat(messages)
      }
    },
    [config.stream, sendStreamingChat, sendNonStreamingChat]
  )

  // Stop generation
  const stopGeneration = useCallback(() => {
    textOnlyRetryRef.current = null
    stopStream()
    flushStreamUpdates()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsRequesting(false)
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        isAssistantMessagePending(message)
          ? completeAssistantMessage(message)
          : message
      )
    )
  }, [stopStream, flushStreamUpdates, onMessageUpdate])

  return {
    sendChat,
    stopGeneration,
    isGenerating: isStreaming || isRequesting,
  }
}
