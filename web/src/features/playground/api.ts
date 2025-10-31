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
  const response = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    skipErrorHandler: true,
  } as any)
  return response.data
}

/**
 * Get user available models
 */
export async function getUserModels(): Promise<ModelOption[]> {
  const response = await api.get(API_ENDPOINTS.USER_MODELS)
  const data = response.data

  if (data.success && Array.isArray(data.data)) {
    return data.data.map((model: string) => ({
      label: model,
      value: model,
    }))
  }

  return []
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const response = await api.get(API_ENDPOINTS.USER_GROUPS)
  const data = response.data

  if (data.success && data.data) {
    const groupData = data.data as Record<
      string,
      { desc: string; ratio: number }
    >

    const groups = Object.entries(groupData).map(([group, info]) => ({
      label:
        info.desc.length > 20 ? info.desc.substring(0, 20) + '...' : info.desc,
      value: group,
      ratio: info.ratio,
      fullLabel: info.desc,
    }))

    return groups
  }

  return []
}
