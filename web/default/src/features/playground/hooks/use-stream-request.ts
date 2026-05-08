import { useCallback, useRef } from 'react'
import { SSE } from 'sse.js'
import { getCommonHeaders } from '@/lib/api'
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants'
import { normalizePlaygroundResponse } from '../lib'
import type {
  ChatCompletionChunk,
  PlaygroundEndpoint,
  PlaygroundImage,
  PlaygroundRequest,
} from '../types'

const ENDPOINT_URLS: Record<PlaygroundEndpoint, string> = {
  'chat-completions': API_ENDPOINTS.CHAT_COMPLETIONS,
  responses: API_ENDPOINTS.RESPONSES,
  'claude-messages': API_ENDPOINTS.CLAUDE_MESSAGES,
  'image-generations': API_ENDPOINTS.IMAGE_GENERATIONS,
}

interface StreamUpdatePayload {
  type: 'reasoning' | 'content'
  chunk: string
}

interface StreamCompletePayload {
  content?: string
  reasoning?: string
  images?: PlaygroundImage[]
}

/**
 * Hook for handling streaming playground requests
 */
export function useStreamRequest() {
  const sseSourceRef = useRef<SSE | null>(null)
  const isStreamCompleteRef = useRef(false)

  const sendStreamRequest = useCallback(
    (
      endpoint: PlaygroundEndpoint,
      payload: PlaygroundRequest,
      onUpdate: (payload: StreamUpdatePayload) => void,
      onComplete: (payload?: StreamCompletePayload) => void,
      onError: (error: string, errorCode?: string) => void
    ) => {
      const source = new SSE(ENDPOINT_URLS[endpoint], {
        headers: getCommonHeaders(),
        method: 'POST',
        payload: JSON.stringify(payload),
      })

      sseSourceRef.current = source
      isStreamCompleteRef.current = false

      const closeSource = () => {
        source.close()
        sseSourceRef.current = null
      }

      const handleError = (errorMessage: string, errorCode?: string) => {
        if (!isStreamCompleteRef.current) {
          onError(errorMessage, errorCode)
          closeSource()
        }
      }

      const completeStream = (payload?: StreamCompletePayload) => {
        if (isStreamCompleteRef.current) return
        isStreamCompleteRef.current = true
        closeSource()
        onComplete(payload)
      }

      const parseData = (data: string, eventType?: string) => {
        if (data === '[DONE]') {
          completeStream()
          return
        }

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>

          if (endpoint === 'responses') {
            const type = typeof parsed.type === 'string' ? parsed.type : eventType
            if (
              (type === 'response.output_text.delta' ||
                type === 'response.reasoning_text.delta') &&
              typeof parsed.delta === 'string'
            ) {
              onUpdate({
                type:
                  type === 'response.reasoning_text.delta'
                    ? 'reasoning'
                    : 'content',
                chunk: parsed.delta,
              })
            }
            if (type === 'response.completed' && parsed.response) {
              completeStream(normalizePlaygroundResponse('responses', parsed.response))
            }
            return
          }

          if (endpoint === 'claude-messages') {
            const type = typeof parsed.type === 'string' ? parsed.type : eventType
            const delta = parsed.delta as Record<string, unknown> | undefined
            if (type === 'content_block_delta' && delta) {
              if (typeof delta.thinking === 'string') {
                onUpdate({ type: 'reasoning', chunk: delta.thinking })
              }
              if (typeof delta.text === 'string') {
                onUpdate({ type: 'content', chunk: delta.text })
              }
            }
            if (type === 'message_stop') completeStream()
            return
          }

          const chunk = parsed as unknown as ChatCompletionChunk
          const delta = chunk.choices?.[0]?.delta

          if (delta?.reasoning_content) {
            onUpdate({ type: 'reasoning', chunk: delta.reasoning_content })
          }
          if (delta?.content) {
            onUpdate({ type: 'content', chunk: delta.content })
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse SSE message:', error)
          handleError(ERROR_MESSAGES.PARSE_ERROR)
        }
      }

      const addDataListener = (eventName: string) => {
        source.addEventListener(eventName, (e: MessageEvent) => {
          parseData(e.data, eventName)
        })
      }

      if (endpoint === 'responses') {
        ;[
          'response.output_text.delta',
          'response.reasoning_text.delta',
          'response.completed',
        ].forEach(addDataListener)
      } else if (endpoint === 'claude-messages') {
        ;['content_block_delta', 'message_stop'].forEach(addDataListener)
      } else {
        addDataListener('message')
      }

      source.addEventListener('error', (e: Event & { data?: string }) => {
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
        onError(ERROR_MESSAGES.STREAM_START_ERROR)
        sseSourceRef.current = null
      }
    },
    []
  )

  const stopStream = useCallback(() => {
    if (sseSourceRef.current) {
      sseSourceRef.current.close()
      sseSourceRef.current = null
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
