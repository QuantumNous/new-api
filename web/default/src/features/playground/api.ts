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
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
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

export interface UploadResult {
  success: boolean
  message?: string
  data?: {
    url: string
    filename: string
    content_type: string
    is_image: boolean
    size: number
  }
}

/**
 * Upload a file to R2 storage
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await api.post('/api/user/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      skipErrorHandler: true,
    } as Record<string, unknown>)
    return res.data
  } catch (error: unknown) {
    const err = error as { response?: { data?: UploadResult } }
    return err?.response?.data || { success: false, message: 'Upload failed' }
  }
}

// ─── Chat History API ───

export interface ChatSession {
  id: string
  user_id: number
  title: string
  model: string
  group_name: string
  message_count: number
  created_at: number
  updated_at: number
}

export interface ChatMessageData {
  id: string
  session_id: string
  role: string
  content: string
  image_urls?: string
  reasoning?: string
  created_at: number
}

export async function getChatSessions(): Promise<ChatSession[]> {
  try {
    const res = await api.get('/api/user/chats')
    return res.data?.success ? res.data.data : []
  } catch {
    return []
  }
}

export async function createChatSession(
  title: string,
  model: string,
  group: string
): Promise<ChatSession | null> {
  try {
    const res = await api.post('/api/user/chats', { title, model, group })
    return res.data?.success ? res.data.data : null
  } catch {
    return null
  }
}

export async function getChatMessages(
  sessionId: string
): Promise<ChatMessageData[]> {
  try {
    const res = await api.get(`/api/user/chats/${sessionId}`)
    return res.data?.success ? res.data.data : []
  } catch {
    return []
  }
}

export async function updateChatTitle(
  sessionId: string,
  title: string
): Promise<boolean> {
  try {
    const res = await api.put(`/api/user/chats/${sessionId}`, { title })
    return res.data?.success ?? false
  } catch {
    return false
  }
}

export async function deleteChatSession(
  sessionId: string
): Promise<boolean> {
  try {
    const res = await api.delete(`/api/user/chats/${sessionId}`)
    return res.data?.success ?? false
  } catch {
    return false
  }
}

export async function saveChatMessage(
  sessionId: string,
  role: string,
  content: string,
  imageUrls?: string,
  reasoning?: string
): Promise<ChatMessageData | null> {
  try {
    const res = await api.post(`/api/user/chats/${sessionId}/messages`, {
      role,
      content,
      image_urls: imageUrls || '',
      reasoning: reasoning || '',
    })
    return res.data?.success ? res.data.data : null
  } catch {
    return null
  }
}
