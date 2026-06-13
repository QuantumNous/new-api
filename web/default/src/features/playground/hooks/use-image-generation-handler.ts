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
import { useCallback } from 'react'
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sendImageEdit, sendImageGeneration } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  buildImageEditFormData,
  buildImageGenerationPayload,
  normalizePlaygroundImageConfig,
  normalizeImageGenerationCount,
  supportsImageEditingModel,
} from '../lib'
import type {
  ImageGenerationConfig,
  ImageReferenceInput,
  ImageReferencePreview,
  ImageResult,
  ImageTask,
} from '../types'

interface UseImageGenerationHandlerOptions {
  config: ImageGenerationConfig
  onTasksUpdate: (
    updater: ImageTask[] | ((prev: ImageTask[]) => ImageTask[])
  ) => void
}

function getImageGenerationError(
  error: unknown,
  forbiddenMessage: string
): {
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

  const upstreamMessage =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    ''
  const normalizedMessage = upstreamMessage.toLowerCase()
  const isForbiddenUpstream =
    normalizedMessage.includes('forbidden') ||
    normalizedMessage.includes('access denied') ||
    normalizedMessage.includes('access forbidden')

  if (isForbiddenUpstream) {
    return {
      message: forbiddenMessage,
      code: err?.response?.data?.error?.code || undefined,
    }
  }

  return {
    message: upstreamMessage || ERROR_MESSAGES.API_REQUEST_ERROR,
    code: err?.response?.data?.error?.code || undefined,
  }
}

function toReferencePreview(
  reference: ImageReferenceInput
): ImageReferencePreview {
  return {
    id: reference.id,
    name: reference.name,
    dataUrl: reference.dataUrl,
    type: reference.type,
    size: reference.size,
  }
}

export function useImageGenerationHandler({
  config,
  onTasksUpdate,
}: UseImageGenerationHandlerOptions) {
  const { t } = useTranslation()

  const updateTask = useCallback(
    (taskId: string, updater: (task: ImageTask) => ImageTask) => {
      onTasksUpdate((prev) =>
        prev.map((task) => (task.id === taskId ? updater(task) : task))
      )
    },
    [onTasksUpdate]
  )

  const generateImage = useCallback(
    async (
      prompt: string,
      referenceImages: ImageReferenceInput[] = [],
      overrideConfig?: ImageGenerationConfig
    ) => {
      const trimmedPrompt = prompt.trim()
      const sourceConfig = normalizePlaygroundImageConfig(
        overrideConfig ?? config
      )
      const requestedCount = normalizeImageGenerationCount(sourceConfig.n)
      const effectiveConfig = {
        ...sourceConfig,
        n: requestedCount,
      }

      if (!trimmedPrompt) {
        toast.error(t('Please enter an image prompt'))
        return
      }

      if (!effectiveConfig.model) {
        toast.error(t('Please select an image model'))
        return
      }

      const isEditMode = referenceImages.length > 0
      if (isEditMode && !supportsImageEditingModel(effectiveConfig.model)) {
        toast.error(
          t('The selected image model does not support reference images')
        )
        return
      }
      const referencePreviews = referenceImages.map(toReferencePreview)

      const nextTasks: ImageTask[] = Array.from(
        { length: requestedCount },
        () => ({
          id: nanoid(),
          prompt: trimmedPrompt,
          config: {
            ...effectiveConfig,
            n: 1,
          },
          mode: isEditMode ? 'edit' : 'generate',
          referenceImages: isEditMode ? referencePreviews : undefined,
          status: 'running',
          createdAt: Date.now(),
        })
      )

      onTasksUpdate((prev) => [...nextTasks, ...prev])

      const results = await Promise.allSettled(
        nextTasks.map(async (task) => {
          try {
            const response = isEditMode
              ? await sendImageEdit(
                  buildImageEditFormData(
                    trimmedPrompt,
                    task.config,
                    referenceImages
                  )
                )
              : await sendImageGeneration(
                  buildImageGenerationPayload(trimmedPrompt, task.config)
                )
            const images = (response.data || []).filter(
              (image): image is ImageResult =>
                Boolean(image.url || image.b64_json)
            )
            const image = images[0]
            if (!image) {
              throw new Error(t('API did not return image data'))
            }

            updateTask(task.id, (current) => ({
              ...current,
              status: 'done',
              image,
              finishedAt: Date.now(),
            }))
          } catch (error: unknown) {
            const parsed = getImageGenerationError(
              error,
              isEditMode
                ? t(
                    'The selected channel does not support image editing for this model'
                  )
                : t(
                    'The selected channel does not have access to this image model, or the upstream does not support image generation for it'
                  )
            )
            updateTask(task.id, (current) => ({
              ...current,
              status: 'error',
              error: parsed.message,
              errorCode: parsed.code,
              finishedAt: Date.now(),
            }))
            throw parsed
          }
        })
      )

      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      if (failures.length === nextTasks.length) {
        const parsed = getImageGenerationError(
          failures[0]?.reason,
          isEditMode
            ? t(
                'The selected channel does not support image editing for this model'
              )
            : t(
                'The selected channel does not have access to this image model, or the upstream does not support image generation for it'
              )
        )
        toast.error(parsed.message)
      }
    },
    [config, onTasksUpdate, t, updateTask]
  )

  const retryTask = useCallback(
    (task: ImageTask) => {
      if (task.mode === 'edit') {
        toast.error(t('Upload the reference images again to retry this edit'))
        return
      }
      void generateImage(task.prompt, [], task.config)
    },
    [generateImage, t]
  )

  return {
    generateImage,
    retryTask,
  }
}
