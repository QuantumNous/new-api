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
import { api } from '@/lib/api'
import { API_ENDPOINTS } from './constants'
import type { MediaGenerationRequest } from './lib/media-generation'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  GroupOption,
  VideoTask,
} from './types'

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function sendMediaGeneration(
  request: MediaGenerationRequest,
  signal?: AbortSignal
): Promise<unknown> {
  const res = await api.post(request.endpoint, request.payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function fetchPlaygroundVideoTask(
  taskId: string,
  signal?: AbortSignal
): Promise<unknown> {
  const res = await api.get(`/pg/videos/${encodeURIComponent(taskId)}`, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Submit an async video-generation task (veo models).
 * POST /v1/videos { model, prompt } -> { id, status, progress, ... }
 */
export async function submitVideo(
  model: string,
  prompt: string
): Promise<VideoTask> {
  const res = await api.post(API_ENDPOINTS.VIDEOS, { model, prompt }, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Poll a video task's status.
 * GET /v1/videos/{id} -> { status, progress, ... }
 * `disableDuplicate` opts out of the GET dedupe cache so each poll is a fresh
 * request rather than a possibly-stale in-flight promise.
 */
export async function fetchVideoStatus(id: string): Promise<VideoTask> {
  const res = await api.get(
    `${API_ENDPOINTS.VIDEOS}/${encodeURIComponent(id)}`,
    {
      disableDuplicate: true,
      skipErrorHandler: true,
    }
  )
  return res.data
}

/**
 * Fetch the finished video as a binary blob.
 * GET /v1/videos/{id}/content -> raw MP4 (video/mp4). Returned as a Blob so the
 * caller can URL.createObjectURL(...) it into a <video> element (the endpoint
 * needs the auth header, so the bare URL can't be used as a <video src>).
 */
export async function fetchVideoContent(id: string): Promise<Blob> {
  const res = await api.get(
    `${API_ENDPOINTS.VIDEOS}/${encodeURIComponent(id)}/content`,
    {
      responseType: 'blob',
      disableDuplicate: true,
      skipErrorHandler: true,
    }
  )
  return res.data as Blob
}

/**
 * Get all models available to the user. Playground-specific display filtering
 * happens at the call site so handoff models can be validated against the raw
 * backend response before being added to the picker.
 */
export async function getUserModels(group?: string): Promise<string[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: group ? { group } : undefined,
  })
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data
    .filter((model: unknown): model is string => typeof model === 'string')
    .map((model: string) => model.trim())
    .filter(Boolean)
}
/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  // label is for button display (name only); desc is for dropdown content
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}
