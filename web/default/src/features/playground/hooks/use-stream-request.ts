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
import { useCallback, useRef } from 'react'
import { SSE } from 'sse.js'
import { getCommonHeaders } from '@/lib/api'
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants'
import { parseStreamMessageEvent } from '../lib/stream-event-parser'
import type {
  ChatCompletionRequest,
  PlaygroundResponseMetadata,
} from '../types'

interface ClosableStreamSource {
  close: () => void
}

interface CurrentStreamSource<T extends ClosableStreamSource> {
  current: T | null
}

export function closeOwnedStreamSource<T extends ClosableStreamSource>(
  holder: CurrentStreamSource<T>,
  source: T
): void {
  source.close()
  if (holder.current === source) holder.current = null
}

/**
 * Hook for handling streaming chat completion requests
 */
export function useStreamRequest() {
  const sseSourceRef = useRef<SSE | null>(null)

  const sendStreamRequest = useCallback(
    (
      payload: ChatCompletionRequest,
      onUpdate: (type: 'reasoning' | 'content', chunk: string) => void,
      onMetadata: (metadata: PlaygroundResponseMetadata) => void,
      onComplete: () => void,
      onError: (error: string, errorCode?: string) => void
    ) => {
      const source = new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
        headers: getCommonHeaders(),
        method: 'POST',
        payload: JSON.stringify(payload),
      })

      sseSourceRef.current = source
      let isStreamComplete = false

      const closeSource = () => {
        closeOwnedStreamSource(sseSourceRef, source)
      }

      const handleError = (errorMessage: string, errorCode?: string) => {
        if (!isStreamComplete) {
          onError(errorMessage, errorCode)
          closeSource()
        }
      }

      source.addEventListener('message', (e: MessageEvent) => {
        if (e.data === '[DONE]') {
          isStreamComplete = true
          closeSource()
          onComplete()
          return
        }

        const parsed = parseStreamMessageEvent(e.data)
        if (parsed.type === 'error') {
          handleError(parsed.message, parsed.code)
          return
        }

        if (parsed.type === 'parse_error') {
          // eslint-disable-next-line no-console
          console.error('Failed to parse SSE message:', e.data)
          handleError(ERROR_MESSAGES.PARSE_ERROR)
          return
        }

        if (parsed.responseMetadata) {
          onMetadata(parsed.responseMetadata)
        }

        if (parsed.reasoning) {
          onUpdate('reasoning', parsed.reasoning)
        }
        if (parsed.content) {
          onUpdate('content', parsed.content)
        }
      })

      source.addEventListener('error', (e: Event & { data?: string }) => {
        // Only handle errors if stream didn't complete normally
        if (source.readyState !== 2) {
          // eslint-disable-next-line no-console
          console.error('SSE Error:', e)
          let errorMessage = e.data || ERROR_MESSAGES.API_REQUEST_ERROR
          let errorCode: string | undefined
          if (e.data) {
            try {
              const parsed = JSON.parse(e.data) as {
                error?: { message?: string; code?: string }
              }
              if (parsed?.error) {
                errorMessage = parsed.error.message || errorMessage
                errorCode = parsed.error.code || undefined
              }
            } catch {
              // not JSON, use raw string
            }
          }
          handleError(errorMessage, errorCode)
        }
      })

      source.addEventListener(
        'readystatechange',
        (e: Event & { readyState?: number }) => {
          const status = (source as unknown as { status?: number }).status
          if (
            e.readyState !== undefined &&
            e.readyState >= 2 &&
            status !== undefined &&
            status !== 200
          ) {
            handleError(`HTTP ${status}: ${ERROR_MESSAGES.CONNECTION_CLOSED}`)
          }
        }
      )

      try {
        source.stream()
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('Failed to start SSE stream:', error)
        handleError(ERROR_MESSAGES.STREAM_START_ERROR)
      }
    },
    []
  )

  const stopStream = useCallback(() => {
    if (sseSourceRef.current) {
      closeOwnedStreamSource(sseSourceRef, sseSourceRef.current)
    }
  }, [])

  // eslint-disable-next-line react-hooks/refs
  const isStreaming = sseSourceRef.current !== null

  return {
    sendStreamRequest,
    stopStream,
    // eslint-disable-next-line react-hooks/refs
    isStreaming,
  }
}
