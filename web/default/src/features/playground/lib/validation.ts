import { t } from 'i18next'
import type { PlaygroundEndpoint } from '../types'

export const IMAGE_QUALITY_OPTIONS = ['low', 'medium', 'high', 'auto'] as const

export const IMAGE_SIZE_PATTERN = /^([1-9]\d*)[xX]([1-9]\d*)$/

export function validateImageSize(size: string): string | null {
  const trimmedSize = size.trim()
  const match = IMAGE_SIZE_PATTERN.exec(trimmedSize)

  if (!match) return t('playground.image.size.formatError')

  const width = Number(match[1])
  const height = Number(match[2])

  if (width > 3840 || height > 3840) {
    return t('playground.image.size.limitError')
  }

  return null
}

export function isImageGenerationEndpoint(
  endpoint: PlaygroundEndpoint
): endpoint is 'image-generations' {
  return endpoint === 'image-generations'
}
