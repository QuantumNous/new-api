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

import { generateImages } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  applyGeneratedImages,
  completeAssistantMessage,
  isAssistantMessagePending,
  parseRequestErrorDetails,
  toGeneratedImageAttachments,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
} from '../lib'
import type { Message, PlaygroundConfig } from '../types'

interface UseImageHandlerOptions {
  config: PlaygroundConfig
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

/**
 * Hook for generating images from the last user prompt.
 */
export function useImageHandler({
  config,
  onMessageUpdate,
}: UseImageHandlerOptions) {
  const { t } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)

  useEffect(
    () => () => {
      generationRef.current += 1
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    },
    []
  )

  const failGeneration = useCallback(
    (message: string, errorCode?: string) => {
      toast.error(message)
      const errorTitle = t(ERROR_MESSAGES.IMAGE_GENERATION_ERROR)
      onMessageUpdate((prev) =>
        updateAssistantMessageWithError(prev, message, errorCode, errorTitle)
      )
    },
    [onMessageUpdate, t]
  )

  const generateImage = useCallback(
    async (prompt: string) => {
      const generation = generationRef.current + 1
      const abortController = new AbortController()

      generationRef.current = generation
      abortControllerRef.current?.abort()
      abortControllerRef.current = abortController

      try {
        setIsGenerating(true)
        const response = await generateImages(
          {
            model: config.model,
            group: config.group,
            prompt,
            n: 1,
          },
          abortController.signal
        )

        if (
          abortController.signal.aborted ||
          generationRef.current !== generation
        ) {
          return
        }

        const attachments = toGeneratedImageAttachments(response, prompt)

        if (attachments.length === 0) {
          failGeneration(t(ERROR_MESSAGES.IMAGE_EMPTY_RESULT))
          return
        }

        onMessageUpdate((prev) =>
          updateLastAssistantMessage(prev, (message) =>
            applyGeneratedImages(message, attachments)
          )
        )
      } catch (error: unknown) {
        if (
          abortController.signal.aborted ||
          generationRef.current !== generation
        ) {
          return
        }

        const { errorCode, errorMessage } = parseRequestErrorDetails(error)
        failGeneration(errorMessage, errorCode)
      } finally {
        if (generationRef.current === generation) {
          abortControllerRef.current = null
          setIsGenerating(false)
        }
      }
    },
    [config.group, config.model, failGeneration, onMessageUpdate, t]
  )

  const stopGeneration = useCallback(() => {
    generationRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsGenerating(false)
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        isAssistantMessagePending(message)
          ? completeAssistantMessage(message)
          : message
      )
    )
  }, [onMessageUpdate])

  return {
    generateImage,
    stopGeneration,
    isGeneratingImage: isGenerating,
  }
}
