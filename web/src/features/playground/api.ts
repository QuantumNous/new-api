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
import { requireServerSuccess } from '@/lib/server-error-message'

import { API_ENDPOINTS } from './constants'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  GenerationRecord,
  GenerationRecordList,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ModelOption,
  GroupOption,
  VideoGenerationRequest,
  VideoTaskResponse,
  VideoTaskSubmission,
} from './types'

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available models
 */
export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<
    string,
    { desc: string; ratio: number | string }
  >

  // label is for button display (name only); desc is for dropdown content
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

/**
 * Get the pricing kind of every model the user can reach, so the playground can
 * keep generators out of the chat picker.
 */
export async function getUserModelKinds(
  group: string
): Promise<Record<string, string>> {
  const res = await api.get(API_ENDPOINTS.USER_MODEL_KINDS, {
    params: { group },
  })
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !data.data) {
    return {}
  }

  return data.data as Record<string, string>
}

/**
 * Generate one image. Returns the raw relay payload: either a `data` array of
 * URLs / base64 payloads, or an error the caller renders inline.
 */
export async function generateImage(
  payload: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const res = await api.post(API_ENDPOINTS.IMAGE_GENERATIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data as ImageGenerationResponse
}

/**
 * Submit a video generation task. The relay answers with a queued task the
 * caller has to poll.
 */
export async function submitVideoTask(
  payload: VideoGenerationRequest
): Promise<VideoTaskSubmission> {
  const res = await api.post(API_ENDPOINTS.VIDEO_GENERATIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data as VideoTaskSubmission
}

/**
 * Read the current state of a submitted video task.
 */
export async function fetchVideoTask(
  taskId: string
): Promise<VideoTaskResponse> {
  const res = await api.get(
    `${API_ENDPOINTS.VIDEO_GENERATIONS}/${encodeURIComponent(taskId)}`,
    { skipErrorHandler: true } as Record<string, unknown>
  )
  return res.data as VideoTaskResponse
}

/**
 * Read the generation history the gateway keeps for this user. Media URLs in
 * the rows are capability links to files stored on the deployment itself, so
 * they survive the upstream link expiring.
 */
export async function fetchGenerationRecords(params: {
  kind: 'image' | 'video'
  page?: number
  pageSize?: number
}): Promise<GenerationRecordList> {
  const res = await api.get(API_ENDPOINTS.GENERATION_RECORDS, {
    params: {
      kind: params.kind,
      p: params.page ?? 1,
      page_size: params.pageSize ?? 50,
    },
  })
  const { data } = res
  requireServerSuccess(data)

  const items = Array.isArray(data?.data)
    ? (data.data as GenerationRecord[])
    : []
  return { items, total: Number(data?.total ?? items.length) }
}

/**
 * Delete one history row. The media files it owns go with it.
 */
export async function deleteGenerationRecord(id: number): Promise<void> {
  const res = await api.delete(
    `${API_ENDPOINTS.GENERATION_RECORDS}/${encodeURIComponent(String(id))}`
  )
  requireServerSuccess(res.data)
}

