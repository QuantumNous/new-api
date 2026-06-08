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
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sendImageGeneration } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { buildImageGenerationPayload, getRawImageUrls } from '../lib'
import type { ImageGenerationConfig, ImageResult, ImageTask } from '../types'

interface UseImageGenerationHandlerOptions {
  config: ImageGenerationConfig
  tasks: ImageTask[]
  onTasksUpdate: (
    updater: ImageTask[] | ((prev: ImageTask[]) => ImageTask[])
  ) => void
}

function getImageGenerationError(error: unknown): {
  message: string
  code?: string
} {
  const err = error as {
    response?: {
      data?: {
        message?: string
        error?: {
          code?: string
          message?: string
        }
      }
    }
    message?: string
  }

  return {
    message:
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.message ||
      ERROR_MESSAGES.API_REQUEST_ERROR,
    code: err?.response?.data?.error?.code || undefined,
  }
}

export function useImageGenerationHandler({
  config,
  tasks,
  onTasksUpdate,
}: UseImageGenerationHandlerOptions) {
  const { t } = useTranslation()

  const isGenerating = useMemo(
    () => tasks.some((task) => task.status === 'running'),
    [tasks]
  )

  const updateTask = useCallback(
    (taskId: string, updater: (task: ImageTask) => ImageTask) => {
      onTasksUpdate((prev) =>
        prev.map((task) => (task.id === taskId ? updater(task) : task))
      )
    },
    [onTasksUpdate]
  )

  const generateImage = useCallback(
    async (prompt: string, overrideConfig?: ImageGenerationConfig) => {
      const trimmedPrompt = prompt.trim()
      const effectiveConfig = overrideConfig ?? config

      if (!trimmedPrompt) {
        toast.error(t('Please enter an image prompt'))
        return
      }

      if (!effectiveConfig.model) {
        toast.error(t('Please select an image model'))
        return
      }

      if (isGenerating) {
        toast.error(t('Please wait for the current image generation to finish'))
        return
      }

      const taskId = nanoid()
      const task: ImageTask = {
        id: taskId,
        prompt: trimmedPrompt,
        config: effectiveConfig,
        status: 'running',
        images: [],
        createdAt: Date.now(),
      }

      onTasksUpdate((prev) => [task, ...prev])

      try {
        const payload = buildImageGenerationPayload(
          trimmedPrompt,
          effectiveConfig
        )
        const response = await sendImageGeneration(payload)
        const images = (response.data || []).filter(
          (image): image is ImageResult => Boolean(image.url || image.b64_json)
        )

        if (images.length === 0) {
          throw new Error(t('API did not return image data'))
        }

        updateTask(taskId, (current) => ({
          ...current,
          status: 'done',
          images,
          rawImageUrls: getRawImageUrls(images),
          finishedAt: Date.now(),
        }))
      } catch (error: unknown) {
        const parsed = getImageGenerationError(error)
        toast.error(parsed.message)
        updateTask(taskId, (current) => ({
          ...current,
          status: 'error',
          error: parsed.message,
          errorCode: parsed.code,
          finishedAt: Date.now(),
        }))
      }
    },
    [config, isGenerating, onTasksUpdate, t, updateTask]
  )

  const retryTask = useCallback(
    (task: ImageTask) => {
      void generateImage(task.prompt, task.config)
    },
    [generateImage]
  )

  return {
    generateImage,
    retryTask,
    isGenerating,
  }
}
