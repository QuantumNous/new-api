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
import i18next from 'i18next'
import { toast } from 'sonner'
import { fetchPlaygroundVideoTask, sendMediaGeneration } from '../api'
import { MESSAGE_STATUS } from '../constants'
import {
  buildMediaGenerationRequest,
  extractGeneratedImages,
  parseVideoTaskResponse,
  updateAssistantMessageWithError,
  updateCurrentVersionContent,
  updateCurrentVersionMedia,
  updateLastAssistantMessage,
  type MediaGenerationSettings,
} from '../lib'
import type { GeneratedMedia, Message } from '../types'

interface UseMediaGenerationOptions {
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

const VIDEO_POLL_INTERVAL_MS = 3000
const VIDEO_POLL_LIMIT = 200

type PollTimeoutScheduler = (callback: () => void, delay: number) => number
type PollTimeoutCanceller = (timer: number) => void

function responseMessageContent(response: unknown): string {
  if (!response || typeof response !== 'object') return ''
  const choices = (response as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : ''
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return i18next.t('Request error occurred')
  }
  const candidate = error as {
    message?: string
    response?: {
      data?: {
        message?: string
        error?: { message?: string }
      }
    }
  }
  return (
    candidate.response?.data?.error?.message ||
    candidate.response?.data?.message ||
    candidate.message ||
    i18next.t('Request error occurred')
  )
}

export function waitForVideoPoll(
  signal: AbortSignal,
  schedule: PollTimeoutScheduler = (callback, delay) =>
    window.setTimeout(callback, delay),
  cancel: PollTimeoutCanceller = (timer) => window.clearTimeout(timer)
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false

    function cleanup() {
      signal.removeEventListener('abort', onAbort)
    }
    function finish() {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    function onAbort() {
      cancel(timer)
      finish()
    }

    const timer = schedule(finish, VIDEO_POLL_INTERVAL_MS)
    if (settled) {
      cancel(timer)
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}

export function useMediaGeneration(props: UseMediaGenerationOptions) {
  const { onMessageUpdate } = props
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false)

  const updateProgress = useCallback(
    (content: string, progress?: number) => {
      onMessageUpdate((messages) =>
        updateLastAssistantMessage(messages, (message) => ({
          ...updateCurrentVersionContent(
            message,
            progress === undefined ? content : `${content} ${progress}%`
          ),
          status: MESSAGE_STATUS.STREAMING,
        }))
      )
    },
    [onMessageUpdate]
  )

  const completeMedia = useCallback(
    (content: string, generatedMedia?: GeneratedMedia[]) => {
      onMessageUpdate((messages) =>
        updateLastAssistantMessage(messages, (message) => ({
          ...updateCurrentVersionMedia(
            updateCurrentVersionContent(message, content),
            generatedMedia
          ),
          status: MESSAGE_STATUS.COMPLETE,
          isContentComplete: true,
        }))
      )
    },
    [onMessageUpdate]
  )

  const failMedia = useCallback(
    (message: string) => {
      toast.error(message)
      onMessageUpdate((messages) =>
        updateAssistantMessageWithError(messages, message)
      )
    },
    [onMessageUpdate]
  )

  const generateMedia = useCallback(
    async (
      prompt: string,
      model: string,
      group: string,
      settings: MediaGenerationSettings
    ) => {
      const request = buildMediaGenerationRequest(
        prompt,
        model,
        group,
        settings
      )
      if (!request) {
        failMedia(i18next.t('This model is not supported in Playground'))
        return
      }

      const controller = new AbortController()
      abortControllerRef.current = controller
      setIsGeneratingMedia(true)

      try {
        const response = await sendMediaGeneration(request, controller.signal)
        if (controller.signal.aborted) return

        if (request.kind === 'image') {
          if (request.endpoint === '/pg/chat/completions') {
            const content = responseMessageContent(response)
            if (!content) throw new Error(i18next.t('No image was generated'))
            completeMedia(content, undefined)
            return
          }

          const outputFormat = request.payload.output_format
          const images = extractGeneratedImages(
            response,
            typeof outputFormat === 'string' ? outputFormat : 'png'
          )
          if (images.length === 0) {
            throw new Error(i18next.t('No image was generated'))
          }
          completeMedia(i18next.t('Generated image'), images)
          return
        }

        const submitted = parseVideoTaskResponse(response)
        if (!submitted) {
          throw new Error(i18next.t('Video task could not be created'))
        }
        updateProgress(i18next.t('Generating video...'), submitted.progress)

        for (let attempt = 0; attempt < VIDEO_POLL_LIMIT; attempt += 1) {
          await waitForVideoPoll(controller.signal)
          if (controller.signal.aborted) return

          const taskResponse = await fetchPlaygroundVideoTask(
            submitted.taskId,
            controller.signal
          )
          const task = parseVideoTaskResponse(taskResponse)
          if (!task) continue
          if (task.status === 'failed') {
            throw new Error(task.error || i18next.t('Video generation failed'))
          }
          if (task.status === 'completed') {
            const url =
              task.url ||
              `/v1/videos/${encodeURIComponent(submitted.taskId)}/content`
            completeMedia(i18next.t('Generated video'), [
              { type: 'video', url },
            ])
            return
          }
          updateProgress(i18next.t('Generating video...'), task.progress)
        }
        throw new Error(i18next.t('Video generation timed out'))
      } catch (error) {
        if (!controller.signal.aborted) failMedia(errorMessage(error))
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
          setIsGeneratingMedia(false)
        }
      }
    },
    [completeMedia, failMedia, updateProgress]
  )

  const stopMediaGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsGeneratingMedia(false)
    onMessageUpdate((messages) =>
      updateLastAssistantMessage(messages, (message) => ({
        ...updateCurrentVersionContent(
          message,
          i18next.t('Generation was interrupted')
        ),
        status: MESSAGE_STATUS.COMPLETE,
      }))
    )
  }, [onMessageUpdate])

  return {
    generateMedia,
    isGeneratingMedia,
    stopMediaGeneration,
  }
}
