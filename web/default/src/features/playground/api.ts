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
import type { PlaygroundConversationSnapshot } from './lib/playground-persistence'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  GroupOption,
  VideoTask,
  PlaygroundRecordPayload,
} from './types'

interface PlaygroundApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

function assertPlaygroundApiSuccess(
  response: PlaygroundApiResponse,
  fallbackMessage: string
): void {
  if (!response.success) {
    throw new Error(response.message || fallbackMessage)
  }
}

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

export async function savePlaygroundRecord(
  payload: PlaygroundRecordPayload
): Promise<void> {
  const res = await api.post(API_ENDPOINTS.PLAYGROUND_RECORDS, payload)
  assertPlaygroundApiSuccess(res.data, 'Failed to save Playground record')
}

export async function getCurrentPlaygroundRecord(): Promise<PlaygroundConversationSnapshot | null> {
  const res = await api.get(API_ENDPOINTS.PLAYGROUND_RECORDS_CURRENT)
  const response =
    res.data as PlaygroundApiResponse<PlaygroundConversationSnapshot | null>
  assertPlaygroundApiSuccess(
    response,
    'Failed to restore the current Playground conversation'
  )

  if (response.data === null) return null
  if (
    !response.data ||
    typeof response.data.conversation_id !== 'string' ||
    !Array.isArray(response.data.messages)
  ) {
    throw new Error('Invalid current Playground conversation response')
  }

  return response.data
}

export async function clearCurrentPlaygroundRecord(
  recordId: string,
  conversationId: string,
  clientCompletedAt: number
): Promise<void> {
  const res = await api.post(API_ENDPOINTS.PLAYGROUND_RECORDS_CLEAR, {
    record_id: recordId,
    conversation_id: conversationId,
    client_completed_at: clientCompletedAt,
  })
  assertPlaygroundApiSuccess(
    res.data,
    'Failed to clear Playground conversation'
  )
}
