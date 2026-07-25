/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

// Option lists for the generation settings panel.
// Image options match the OpenAI Images schema (GPT Image / Grok Imagine).

import {
  GPT_IMAGE_COUNTS,
  GPT_IMAGE_QUALITIES,
  GPT_IMAGE_SIZES,
} from './image-request-schema'

export const IMAGE_SIZES = GPT_IMAGE_SIZES
export const IMAGE_QUALITIES = GPT_IMAGE_QUALITIES
export const IMAGE_COUNTS = GPT_IMAGE_COUNTS

export const VIDEO_SIZES = ['1280x720', '720x1280', '1920x1080'] as const
export const VIDEO_DURATIONS = [1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60] as const
export const VOICES = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
] as const
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const
export const AUDIO_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav'] as const

function aspectFromSize(size: string): string {
  const [w, h] = size.split('x').map(Number)
  if (!w || !h) return size
  if (w === h) return '1:1'
  if (w > h) return '16:9'
  return '9:16'
}

function resolutionLabel(size: string): string {
  if (size.includes('1920') || size.includes('1080')) return '1080p'
  if (size.includes('1280') || size === '720x1280' || size.includes('720')) {
    return '720p'
  }
  return size
}

/** Combined aspect + resolution so landscape/portrait 720p stay distinct. */
export function videoSizeLabel(size: string): string {
  return `${resolutionLabel(size)} · ${aspectFromSize(size)}`
}

export { imageQualityLabelKey, imageSizeLabel } from './image-request-schema'
