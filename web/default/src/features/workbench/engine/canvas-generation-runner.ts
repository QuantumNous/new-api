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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import {
  generateImages,
  generateSpeech,
  submitVideo,
  uploadPlaygroundAsset,
} from '@/features/playground/api'
import { persistGeneratedMediaAsset } from '@/features/playground/lib/download-generated-media'
import { DEFAULT_STUDIO_SETTINGS } from '@/features/playground/lib/storage/store-migration'
import type { StudioSettings } from '@/features/playground/types'
import { getUserTaskLogs } from '@/features/usage-logs/api'
import type { TaskLog } from '@/features/usage-logs/types'

export type CanvasGenerationSettings = {
  model: string
  group: string
  size?: string
  quality?: string
  count?: number
  seconds?: string
  audioVoice?: string
  audioFormat?: string
  audioSpeed?: string
}

export type CanvasImageGenerationResult = {
  images: Array<{
    url: string
    assetId?: number
    naturalWidth?: number
    naturalHeight?: number
  }>
}

const VIDEO_POLL_INTERVAL_MS = 5000
const VIDEO_POLL_TIMEOUT_MS = 10 * 60 * 1000

function buildImageStudioSettings(
  settings: CanvasGenerationSettings
): StudioSettings {
  return {
    ...DEFAULT_STUDIO_SETTINGS,
    imageCount: settings.count ?? 1,
    imageSize: settings.size || DEFAULT_STUDIO_SETTINGS.imageSize,
    imageQuality: settings.quality || DEFAULT_STUDIO_SETTINGS.imageQuality,
  }
}

function buildVideoStudioSettings(
  settings: CanvasGenerationSettings
): StudioSettings {
  const parsedDuration = Number(settings.seconds)
  return {
    ...DEFAULT_STUDIO_SETTINGS,
    videoDuration: Number.isFinite(parsedDuration)
      ? parsedDuration
      : DEFAULT_STUDIO_SETTINGS.videoDuration,
    videoSize: settings.size || DEFAULT_STUDIO_SETTINGS.videoSize,
  }
}

function buildAudioStudioSettings(
  settings: CanvasGenerationSettings
): StudioSettings {
  const parsedSpeed = Number(settings.audioSpeed)
  return {
    ...DEFAULT_STUDIO_SETTINGS,
    voice: settings.audioVoice || DEFAULT_STUDIO_SETTINGS.voice,
    audioFormat: settings.audioFormat || DEFAULT_STUDIO_SETTINGS.audioFormat,
    speed: Number.isFinite(parsedSpeed)
      ? parsedSpeed
      : DEFAULT_STUDIO_SETTINGS.speed,
  }
}

function measureImageSize(
  url: string
): Promise<{ naturalWidth: number; naturalHeight: number } | undefined> {
  if (typeof Image === 'undefined') return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const image = new Image()
    image.addEventListener('load', () => {
      resolve({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
    })
    image.addEventListener('error', () => resolve(undefined))
    image.src = url
  })
}

function parseTaskProgress(progress?: string): number | null {
  const parsed = Number.parseFloat(progress ?? '')
  if (!Number.isFinite(parsed)) return null
  return Math.min(100, Math.max(0, parsed))
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Aborted', 'AbortError')
  }
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError()
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function pollVideoTask(
  taskId: string,
  options: {
    onProgress?: (progress: {
      status?: string
      percent: number | null
      taskId: string
    }) => void
    signal?: AbortSignal
  }
): Promise<TaskLog> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < VIDEO_POLL_TIMEOUT_MS) {
    throwIfAborted(options.signal)
    const response = await getUserTaskLogs({ p: 1, page_size: 20 })
    throwIfAborted(options.signal)
    const items = (response.data?.items ?? []) as TaskLog[]
    const task = items.find((item) => item.task_id === taskId)
    if (task) {
      options.onProgress?.({
        status: task.status,
        percent: parseTaskProgress(task.progress),
        taskId,
      })
      if (task.status === 'SUCCESS') return task
      if (task.status === 'FAILURE') {
        throw new Error(task.fail_reason || 'Video generation failed')
      }
    }
    await delay(VIDEO_POLL_INTERVAL_MS, options.signal)
  }
  throw new Error('Video generation timed out')
}

export async function runCanvasImageGeneration(input: {
  prompt: string
  referenceImages: string[]
  settings: CanvasGenerationSettings
}): Promise<CanvasImageGenerationResult> {
  const [referenceImage, ...extraReferences] = input.referenceImages
  const generated = await generateImages({
    model: input.settings.model,
    group: input.settings.group,
    prompt: input.prompt,
    settings: buildImageStudioSettings(input.settings),
    referenceImage,
    referenceImages: extraReferences,
    editMode: Boolean(referenceImage),
  })

  const timestamp = Date.now()
  const images = await Promise.all(
    generated.map(async (item, index) => {
      let url = item.url
      let assetId = item.assetId
      try {
        const asset = await persistGeneratedMediaAsset(
          item.url,
          `canvas-image-${timestamp}-${index}.png`,
          'image'
        )
        url = asset.url
        assetId = asset.id
      } catch {
        // Prefer original URL when asset persistence fails.
      }
      const measured = await measureImageSize(url)
      return {
        url,
        assetId,
        naturalWidth: measured?.naturalWidth,
        naturalHeight: measured?.naturalHeight,
      }
    })
  )

  return { images }
}

export async function runCanvasVideoGeneration(input: {
  prompt: string
  referenceImages: string[]
  /** when true the second upstream image is not sent as the tail frame */
  disableLastFrame?: boolean
  settings: CanvasGenerationSettings
  onProgress?: (progress: {
    status?: string
    percent: number | null
    taskId: string
  }) => void
  signal?: AbortSignal
}): Promise<{ url: string; assetId?: number; taskId: string }> {
  throwIfAborted(input.signal)
  const [firstFrame, secondFrame] = input.referenceImages
  const submission = await submitVideo({
    model: input.settings.model,
    group: input.settings.group,
    prompt: input.prompt,
    settings: buildVideoStudioSettings(input.settings),
    firstFrame,
    lastFrame: input.disableLastFrame ? undefined : secondFrame,
  })
  throwIfAborted(input.signal)

  const taskId = submission.taskId
  input.onProgress?.({
    status: submission.status,
    percent: null,
    taskId,
  })
  await pollVideoTask(taskId, {
    onProgress: input.onProgress,
    signal: input.signal,
  })

  const url = `/v1/videos/${taskId}/content`
  let finalUrl = url
  let assetId: number | undefined
  try {
    const asset = await persistGeneratedMediaAsset(
      url,
      `canvas-video-${taskId}.mp4`,
      'video'
    )
    finalUrl = asset.url
    assetId = asset.id
  } catch {
    // Prefer original URL when asset persistence fails.
  }

  return { url: finalUrl, assetId, taskId }
}

export async function runCanvasAudioGeneration(input: {
  text: string
  settings: CanvasGenerationSettings
}): Promise<{ url: string; assetId?: number }> {
  const studioSettings = buildAudioStudioSettings(input.settings)
  const blob = await generateSpeech({
    model: input.settings.model,
    group: input.settings.group,
    text: input.text,
    settings: studioSettings,
    voiceId: input.settings.audioVoice,
  })

  const extension = studioSettings.audioFormat || 'mp3'
  const file = new File([blob], `canvas-audio-${Date.now()}.${extension}`, {
    type: blob.type || `audio/${extension}`,
  })

  try {
    const asset = await uploadPlaygroundAsset(file, 'audio')
    return { url: asset.url, assetId: asset.id }
  } catch {
    return { url: URL.createObjectURL(blob) }
  }
}
