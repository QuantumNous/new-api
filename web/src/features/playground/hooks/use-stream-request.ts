import { useCallback, useRef } from 'react'
import { SSE } from 'sse.js'
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants'
import type { ChatCompletionRequest, ChatCompletionChunk } from '../types'

/**
 * Hook for handling streaming chat completion requests
 */
export function useStreamRequest() {
  const sseSourceRef = useRef<SSE | null>(null)

  const sendStreamRequest = useCallback(
    (
      payload: ChatCompletionRequest,
      onUpdate: (type: 'reasoning' | 'content', chunk: string) => void,
      onComplete: () => void,
      onError: (error: string) => void
    ) => {
      // Get user ID from localStorage for authentication
      const uid =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('uid') || ''
          : ''

      const source = new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
        headers: {
          'Content-Type': 'application/json',
          'New-Api-User': uid,
        },
        method: 'POST',
        payload: JSON.stringify(payload),
      })

      sseSourceRef.current = source

      let isStreamComplete = false

      source.addEventListener('message', (e: any) => {
        if (e.data === '[DONE]') {
          isStreamComplete = true
          source.close()
          sseSourceRef.current = null
          onComplete()
          return
        }

        try {
          const chunk: ChatCompletionChunk = JSON.parse(e.data)
          const delta = chunk.choices?.[0]?.delta

          if (delta) {
            if (delta.reasoning_content) {
              onUpdate('reasoning', delta.reasoning_content)
            }
            if (delta.content) {
              onUpdate('content', delta.content)
            }
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
          onError(ERROR_MESSAGES.PARSE_ERROR)
          source.close()
          sseSourceRef.current = null
        }
      })

      source.addEventListener('error', (e: any) => {
        // Only handle errors if stream didn't complete normally
        if (!isStreamComplete && source.readyState !== 2) {
          console.error('SSE Error:', e)
          const errorMessage = e.data || ERROR_MESSAGES.API_REQUEST_ERROR
          onError(errorMessage)
          source.close()
          sseSourceRef.current = null
        }
      })

      source.addEventListener('readystatechange', (e: any) => {
        // Check for HTTP status errors
        if (
          e.readyState >= 2 &&
          (source as any).status !== undefined &&
          (source as any).status !== 200 &&
          !isStreamComplete
        ) {
          const errorMessage = `HTTP ${(source as any).status}: ${ERROR_MESSAGES.CONNECTION_CLOSED}`
          onError(errorMessage)
          source.close()
          sseSourceRef.current = null
        }
      })

      try {
        source.stream()
      } catch (error: any) {
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

  return {
    sendStreamRequest,
    stopStream,
    isStreaming: () => sseSourceRef.current !== null,
  }
}
