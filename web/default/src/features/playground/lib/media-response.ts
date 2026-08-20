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
import type { GeneratedMedia } from '../types'

interface VideoTaskState {
  taskId: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  progress?: number
  url?: string
  error?: string
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function imageMimeType(format: unknown, fallbackFormat: string): string {
  const normalized = typeof format === 'string' ? format.toLowerCase() : ''
  const effectiveFormat = normalized || fallbackFormat.toLowerCase()
  if (effectiveFormat === 'jpg') return 'image/jpeg'
  if (effectiveFormat === 'jpeg') return 'image/jpeg'
  if (effectiveFormat === 'webp') return 'image/webp'
  return 'image/png'
}

export function extractGeneratedImages(
  response: unknown,
  fallbackFormat = 'png'
): GeneratedMedia[] {
  const body = asRecord(response)
  if (!body || !Array.isArray(body.data)) return []

  const media: GeneratedMedia[] = []
  body.data.forEach((entry) => {
    const item = asRecord(entry)
    if (!item) return
    if (typeof item.url === 'string' && item.url.trim()) {
      media.push({ type: 'image', url: item.url })
      return
    }
    if (typeof item.b64_json === 'string' && item.b64_json.trim()) {
      const mimeType = imageMimeType(item.output_format, fallbackFormat)
      media.push({
        type: 'image',
        url: `data:${mimeType};base64,${item.b64_json}`,
      })
    }
  })
  return media
}

function normalizeVideoStatus(
  status: unknown
): VideoTaskState['status'] | undefined {
  if (typeof status !== 'string') return undefined
  const normalized = status.trim().toLowerCase()
  if (['success', 'succeeded', 'completed'].includes(normalized)) {
    return 'completed'
  }
  if (['failure', 'failed', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed'
  }
  if (['processing', 'in_progress', 'running'].includes(normalized)) {
    return 'in_progress'
  }
  if (['submitted', 'queued', 'pending'].includes(normalized)) return 'queued'
  return undefined
}

function normalizeProgress(progress: unknown): number | undefined {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    return Math.min(100, Math.max(0, progress))
  }
  if (typeof progress !== 'string') return undefined
  const parsed = Number(progress.replace('%', ''))
  if (!Number.isFinite(parsed)) return undefined
  return Math.min(100, Math.max(0, parsed))
}

function taskError(item: Record<string, unknown>): string | undefined {
  if (typeof item.fail_reason === 'string' && item.fail_reason.trim()) {
    return item.fail_reason
  }
  if (typeof item.error === 'string' && item.error.trim()) return item.error
  const errorObject = asRecord(item.error)
  if (errorObject && typeof errorObject.message === 'string') {
    return errorObject.message
  }
  return undefined
}

export function parseVideoTaskResponse(
  response: unknown
): VideoTaskState | undefined {
  const root = asRecord(response)
  if (!root) return undefined
  const wrapped = asRecord(root.data)
  const item = wrapped ?? root
  const rawTaskId = item.task_id ?? item.id
  if (typeof rawTaskId !== 'string' || !rawTaskId.trim()) return undefined
  const status = normalizeVideoStatus(item.status)
  if (!status) return undefined

  const metadata = asRecord(item.metadata)
  const rawUrl = item.result_url ?? item.url ?? metadata?.url
  const result: VideoTaskState = {
    taskId: rawTaskId,
    status,
  }
  const progress = normalizeProgress(item.progress)
  if (progress !== undefined) result.progress = progress
  if (typeof rawUrl === 'string' && rawUrl.trim()) result.url = rawUrl
  const error = taskError(item)
  if (error) result.error = error
  return result
}
