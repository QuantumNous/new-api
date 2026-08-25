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
import i18next from 'i18next'
import { toast } from 'sonner'
import { fetchPlaygroundVideoTask, sendMediaGeneration } from '../api'
import { MESSAGE_ROLES, MESSAGE_STATUS } from '../constants'
import {
  buildMediaGenerationRequest,
  extractGeneratedImages,
  parseVideoTaskResponse,
  updateAssistantMessageWithError,
  updateCurrentVersionContent,
  updateCurrentVersionMedia,
  type MediaGenerationSettings,
} from '../lib'
import type { GeneratedMedia, Message } from '../types'

interface UseMediaGenerationOptions {
  messages: Message[]
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

const VIDEO_POLL_INTERVAL_MS = 3000
const VIDEO_POLL_LIMIT = 200

type PollTimeoutScheduler = (callback: () => void, delay: number) => number
type PollTimeoutCanceller = (timer: number) => void

function clearVideoTaskId(message: Message): Message {
  if (!Object.prototype.hasOwnProperty.call(message, 'videoTaskId')) {
    return message
  }
  const updated = { ...message }
  delete updated.videoTaskId
  return updated
}

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

export function findResumableVideoMessage(
  messages: Message[]
): Message | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (
      message?.from === MESSAGE_ROLES.ASSISTANT &&
      (message.status === MESSAGE_STATUS.LOADING ||
        message.status === MESSAGE_STATUS.STREAMING) &&
      typeof message.videoTaskId === 'string' &&
      message.videoTaskId.trim()
    ) {
      return message
    }
  }
  return undefined
}

export function useMediaGeneration(props: UseMediaGenerationOptions) {
  const { messages, onMessageUpdate } = props
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeMessageKeyRef = useRef<string | null>(null)
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false)

  const updateProgress = useCallback(
    (
      messageKey: string,
      content: string,
      progress?: number,
      videoTaskId?: string
    ) => {
      onMessageUpdate((messages) =>
        messages.map((message) =>
          message.key === messageKey
            ? {
                ...updateCurrentVersionContent(
                  message,
                  progress === undefined ? content : `${content} ${progress}%`
                ),
                status: MESSAGE_STATUS.STREAMING,
                ...(videoTaskId ? { videoTaskId } : {}),
              }
            : message
        )
      )
    },
    [onMessageUpdate]
  )

  const completeMedia = useCallback(
    (
      messageKey: string,
      content: string,
      generatedMedia?: GeneratedMedia[]
    ) => {
      onMessageUpdate((messages) =>
        messages.map((message) =>
          message.key === messageKey
            ? clearVideoTaskId({
                ...updateCurrentVersionMedia(
                  updateCurrentVersionContent(message, content),
                  generatedMedia
                ),
                status: MESSAGE_STATUS.COMPLETE,
                isContentComplete: true,
              })
            : message
        )
      )
    },
    [onMessageUpdate]
  )

  const failMedia = useCallback(
    (messageKey: string, error: string) => {
      toast.error(error)
      onMessageUpdate((messages) =>
        messages.map((message) =>
          message.key === messageKey
            ? clearVideoTaskId(
                updateAssistantMessageWithError([message], error)[0]
              )
            : message
        )
      )
    },
    [onMessageUpdate]
  )

  const pollVideoTask = useCallback(
    async (
      taskId: string,
      messageKey: string,
      controller: AbortController,
      initialTask?: ReturnType<typeof parseVideoTaskResponse>
    ) => {
      let task = initialTask

      for (let attempt = 0; attempt < VIDEO_POLL_LIMIT; attempt += 1) {
        if (!task) {
          const taskResponse = await fetchPlaygroundVideoTask(
            taskId,
            controller.signal
          )
          task = parseVideoTaskResponse(taskResponse)
          if (!task) {
            await waitForVideoPoll(controller.signal)
            if (controller.signal.aborted) return
            continue
          }
        }

        if (task.status === 'failed') {
          throw new Error(task.error || i18next.t('Video generation failed'))
        }
        if (task.status === 'completed') {
          const url =
            task.url || `/v1/videos/${encodeURIComponent(taskId)}/content`
          completeMedia(messageKey, i18next.t('Generated video'), [
            { type: 'video', url },
          ])
          return
        }

        updateProgress(
          messageKey,
          i18next.t('Generating video...'),
          task.progress,
          taskId
        )
        await waitForVideoPoll(controller.signal)
        if (controller.signal.aborted) return
        task = undefined
      }

      throw new Error(i18next.t('Video generation timed out'))
    },
    [completeMedia, updateProgress]
  )

  const runVideoPolling = useCallback(
    async (
      taskId: string,
      messageKey: string,
      controller: AbortController,
      initialTask?: ReturnType<typeof parseVideoTaskResponse>
    ) => {
      try {
        await pollVideoTask(taskId, messageKey, controller, initialTask)
      } catch (error) {
        if (!controller.signal.aborted) {
          failMedia(messageKey, errorMessage(error))
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
          activeMessageKeyRef.current = null
          setIsGeneratingMedia(false)
        }
      }
    },
    [failMedia, pollVideoTask]
  )

  const generateMedia = useCallback(
    async (
      prompt: string,
      model: string,
      group: string,
      settings: MediaGenerationSettings,
      assistantMessageKey: string
    ) => {
      if (abortControllerRef.current) return

      const request = buildMediaGenerationRequest(
        prompt,
        model,
        group,
        settings
      )
      if (!request) {
        failMedia(
          assistantMessageKey,
          i18next.t('This model is not supported in Playground')
        )
        return
      }

      const controller = new AbortController()
      abortControllerRef.current = controller
      activeMessageKeyRef.current = assistantMessageKey
      setIsGeneratingMedia(true)

      try {
        const response = await sendMediaGeneration(request, controller.signal)
        if (controller.signal.aborted) return

        if (request.kind === 'image') {
          if (request.endpoint === '/pg/chat/completions') {
            const content = responseMessageContent(response)
            if (!content) throw new Error(i18next.t('No image was generated'))
            completeMedia(assistantMessageKey, content, undefined)
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
          completeMedia(
            assistantMessageKey,
            i18next.t('Generated image'),
            images
          )
          return
        }

        const submitted = parseVideoTaskResponse(response)
        if (!submitted) {
          throw new Error(i18next.t('Video task could not be created'))
        }
        await pollVideoTask(
          submitted.taskId,
          assistantMessageKey,
          controller,
          submitted
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          failMedia(assistantMessageKey, errorMessage(error))
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
          activeMessageKeyRef.current = null
          setIsGeneratingMedia(false)
        }
      }
    },
    [completeMedia, failMedia, pollVideoTask]
  )

  useEffect(() => {
    if (abortControllerRef.current) return
    const pendingMessage = findResumableVideoMessage(messages)
    if (!pendingMessage?.videoTaskId) return

    const controller = new AbortController()
    abortControllerRef.current = controller
    activeMessageKeyRef.current = pendingMessage.key
    queueMicrotask(() => {
      if (
        !controller.signal.aborted &&
        abortControllerRef.current === controller
      ) {
        setIsGeneratingMedia(true)
      }
    })
    void runVideoPolling(
      pendingMessage.videoTaskId,
      pendingMessage.key,
      controller
    )
  }, [messages, runVideoPolling])

  useEffect(() => {
    return () => {
      const controller = abortControllerRef.current
      abortControllerRef.current = null
      activeMessageKeyRef.current = null
      controller?.abort()
    }
  }, [])

  const stopMediaGeneration = useCallback(() => {
    const activeMessageKey = activeMessageKeyRef.current
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    activeMessageKeyRef.current = null
    setIsGeneratingMedia(false)
    onMessageUpdate((messages) =>
      messages.map((message) =>
        message.key === activeMessageKey
          ? clearVideoTaskId({
              ...updateCurrentVersionContent(
                message,
                i18next.t('Generation was interrupted')
              ),
              status: MESSAGE_STATUS.COMPLETE,
            })
          : message
      )
    )
  }, [onMessageUpdate])

  return {
    generateMedia,
    isGeneratingMedia,
    stopMediaGeneration,
  }
}
