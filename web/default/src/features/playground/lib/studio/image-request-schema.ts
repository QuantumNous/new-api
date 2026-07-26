/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

/**
 * Playground image generation uses one OpenAI Images API request shape for
 * every allowed model (GPT Image 2 and Grok Imagine image):
 *
 *   { model, prompt, n, size, quality, group?, image?, images? }
 *
 * Official GPT Image quality values (OpenAI docs): auto | low | medium | high.
 * Size presets used in the UI: 1024x1024 | 1536x1024 | 1024x1536 | auto.
 * Channel adaptors may drop fields their upstream does not support; the
 * playground always speaks GPT format.
 */

/** Canonical default model id when auto-picking. */
export const PLAYGROUND_IMAGE_MODEL = 'gpt-image-2' as const

export const GPT_IMAGE_SIZES = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  'auto',
] as const

/** Official GPT Image / gpt-image-2 quality enum (not DALL·E standard/hd). */
export const GPT_IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high'] as const

export const GPT_IMAGE_COUNTS = [1, 2, 3, 4] as const

export type GptImageSize = (typeof GPT_IMAGE_SIZES)[number]
export type GptImageQuality = (typeof GPT_IMAGE_QUALITIES)[number]

export const DEFAULT_IMAGE_SIZE: GptImageSize = '1024x1024'
export const DEFAULT_IMAGE_QUALITY: GptImageQuality = 'auto'
export const DEFAULT_IMAGE_COUNT = 1
export const MAX_IMAGE_COUNT = 4

const GPT_IMAGE_SIZE_SET = new Set<string>(GPT_IMAGE_SIZES)
const GPT_IMAGE_QUALITY_SET = new Set<string>(GPT_IMAGE_QUALITIES)

/** Older localStorage values → GPT Image enums (silent clamp only). */
const LEGACY_QUALITY_MAP: Record<string, GptImageQuality> = {
  standard: 'medium',
  hd: 'high',
  normal: 'medium',
  default: 'auto',
}

const LEGACY_SIZE_MAP: Record<string, GptImageSize> = {
  '256x256': '1024x1024',
  '512x512': '1024x1024',
  '1024x1792': '1024x1536',
  '1792x1024': '1536x1024',
  '1024×1024': '1024x1024',
  '1536×1024': '1536x1024',
  '1024×1536': '1024x1536',
}

export type ImageGenerationSettingsInput = {
  imageCount?: unknown
  imageSize?: unknown
  imageQuality?: unknown
}

export type NormalizedImageGenerationSettings = {
  imageCount: number
  imageSize: GptImageSize
  imageQuality: GptImageQuality
}

/** OpenAI Images API body used by playground for every image model. */
export type ImageGenerationRequestBody = {
  model: string
  group: string
  prompt: string
  n: number
  size: GptImageSize
  quality: GptImageQuality
  image?: string
  images?: string[]
}

export function bareModelId(model: string): string {
  const name = model.trim().toLowerCase()
  if (!name) return ''
  return name.includes('/') ? (name.split('/').pop() ?? name) : name
}

function isGptImage2Id(bare: string): boolean {
  return bare === 'gpt-image-2' || bare.startsWith('gpt-image-2-')
}

function isGrokImagineImageId(bare: string): boolean {
  // grok-imagine-image, grok-imagine-image-pro, grok-2-image-1212, …
  return (
    bare === 'grok-imagine-image' ||
    bare.startsWith('grok-imagine-image-') ||
    bare.startsWith('grok-2-image')
  )
}

/**
 * Models allowed on the playground image path. All of them are invoked with
 * the same OpenAI Images request shape.
 */
export function isPlaygroundImageModel(model: string): boolean {
  const bare = bareModelId(model)
  if (!bare) return false
  return isGptImage2Id(bare) || isGrokImagineImageId(bare)
}

export function normalizeImageSize(value: unknown): GptImageSize {
  if (typeof value !== 'string') return DEFAULT_IMAGE_SIZE
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_IMAGE_SIZE
  const mapped =
    LEGACY_SIZE_MAP[trimmed] ?? LEGACY_SIZE_MAP[trimmed.toLowerCase()]
  if (mapped) return mapped
  const ascii = trimmed.replaceAll('×', 'x').toLowerCase()
  if (GPT_IMAGE_SIZE_SET.has(ascii)) return ascii as GptImageSize
  if (GPT_IMAGE_SIZE_SET.has(trimmed)) return trimmed as GptImageSize
  return DEFAULT_IMAGE_SIZE
}

export function normalizeImageQuality(value: unknown): GptImageQuality {
  if (typeof value !== 'string') return DEFAULT_IMAGE_QUALITY
  const key = value.trim().toLowerCase()
  if (!key) return DEFAULT_IMAGE_QUALITY
  if (LEGACY_QUALITY_MAP[key]) return LEGACY_QUALITY_MAP[key]
  if (GPT_IMAGE_QUALITY_SET.has(key)) return key as GptImageQuality
  return DEFAULT_IMAGE_QUALITY
}

export function normalizeImageCount(value: unknown): number {
  let n = Number.NaN
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string') {
    n = Number(value)
  }
  if (!Number.isFinite(n)) return DEFAULT_IMAGE_COUNT
  return Math.min(MAX_IMAGE_COUNT, Math.max(1, Math.round(n)))
}

export function normalizeImageGenerationSettings(
  input: ImageGenerationSettingsInput
): NormalizedImageGenerationSettings {
  return {
    imageCount: normalizeImageCount(input.imageCount),
    imageSize: normalizeImageSize(input.imageSize),
    imageQuality: normalizeImageQuality(input.imageQuality),
  }
}

/**
 * Build the JSON body for `/pg/images/generations` or edits.
 * Always GPT Images shape; model must be an allowed playground image model.
 */
export function buildImageGenerationRequestBody(input: {
  model: string
  group: string
  prompt: string
  settings: ImageGenerationSettingsInput
  referenceImage?: string | null
  referenceImages?: Array<string | null | undefined>
}): ImageGenerationRequestBody {
  const model = input.model.trim()
  if (!model) {
    throw new Error('model is required')
  }
  if (!isPlaygroundImageModel(model)) {
    throw new Error(
      'Playground image generation uses GPT-format models only (gpt-image-2 or grok-imagine-image). Select one and try again.'
    )
  }
  const prompt = input.prompt.trim()
  if (!prompt) {
    throw new Error('prompt is required')
  }

  const normalized = normalizeImageGenerationSettings(input.settings)
  // Keep catalog id (strip only vendor org prefix) for channel routing.
  const wireModel = bareModelId(model) || model
  const body: ImageGenerationRequestBody = {
    model: wireModel,
    group: input.group,
    prompt,
    n: normalized.imageCount,
    size: normalized.imageSize,
    quality: normalized.imageQuality,
  }

  const references = [input.referenceImage, ...(input.referenceImages ?? [])]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
  const uniqueReferences = [...new Set(references)]
  if (uniqueReferences.length > 0) {
    body.image = uniqueReferences[0]
    body.images = uniqueReferences
  }

  return body
}

export function imageQualityLabelKey(quality: GptImageQuality): string {
  switch (quality) {
    case 'low':
      return 'Low'
    case 'medium':
      return 'Medium'
    case 'high':
      return 'High'
    default:
      return 'Auto'
  }
}

export function imageSizeLabel(size: GptImageSize): string {
  if (size === 'auto') return 'Auto'
  if (size === '1024x1024') return '1:1 · 1024'
  if (size === '1536x1024') return '3:2 · 1536×1024'
  if (size === '1024x1536') return '2:3 · 1024×1536'
  return size
}
