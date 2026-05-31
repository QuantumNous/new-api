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
import { API_ENDPOINTS, VIDEO_API_ENDPOINTS } from './constants'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
  TokenOption,
  VideoGenerationRequest,
  VideoTaskResponse,
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

/**
 * Get user available models
 */
export async function getUserModels(): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS)
  const { data } = res

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

/**
 * Get user token list (for video API key selector)
 */
export async function getUserTokens(): Promise<TokenOption[]> {
  const res = await api.get('/api/token/?p=1&size=100')
  const { success, data } = res.data
  if (!success || !Array.isArray(data?.items)) return []
  return data.items
    .filter((t: { status: number }) => t.status === 1)
    .map((t: { id: number; name: string; key: string }) => ({
      id: t.id,
      name: t.name,
      key: t.key,
    }))
}

/**
 * Fetch real (unmasked) key for a token
 */
export async function fetchTokenKey(id: number): Promise<string | null> {
  const res = await api.post(`/api/token/${id}/key`, undefined, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const { success, data } = res.data
  if (!success || !data?.key) return null
  return data.key as string
}

/**
 * Submit a video generation task
 */
export async function submitVideoGeneration(
  payload: VideoGenerationRequest,
  apiKey: string
): Promise<VideoTaskResponse> {
  const res = await api.post(VIDEO_API_ENDPOINTS.SUBMIT, payload, {
    skipErrorHandler: true,
    skipBusinessError: true,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  } as Record<string, unknown>)
  return res.data
}

/**
 * Fetch video task status by task ID
 */
export async function fetchVideoTaskStatus(
  taskId: string,
  apiKey: string
): Promise<VideoTaskResponse> {
  const res = await api.get(VIDEO_API_ENDPOINTS.STATUS(taskId), {
    skipErrorHandler: true,
    skipBusinessError: true,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  } as Record<string, unknown>)
  return res.data
}
