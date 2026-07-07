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
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

const KNOWN_ERROR_MESSAGES = new Set<string>(Object.values(ERROR_MESSAGES))
const STREAM_UPDATE_FLUSH_MS = 50

type PendingStreamChunks = {
  content: string
  reasoning: string
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

  const flushStreamUpdates = useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current)
      streamFlushTimerRef.current = null
    }

    const pendingChunks = pendingStreamChunksRef.current
    if (!pendingChunks.reasoning && !pendingChunks.content) {
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
    (type: 'reasoning' | 'content', chunk: string) => {
      pendingStreamChunksRef.current[type] = mergePendingStreamChunk(
        pendingStreamChunksRef.current[type],
        chunk
      )
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

  // Send streaming chat request
  const sendStreamingChat = useCallback(
    (messages: Message[]) => {
      setIsRequesting(true)
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
