import { api } from '@/lib/api'
import { API_ENDPOINTS } from './constants'
import { inferPlaygroundEndpoint } from './lib/endpoint'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
  PlaygroundEndpoint,
  PlaygroundRequest,
} from './types'

const ENDPOINT_URLS: Record<PlaygroundEndpoint, string> = {
  'chat-completions': API_ENDPOINTS.CHAT_COMPLETIONS,
  responses: API_ENDPOINTS.RESPONSES,
  'claude-messages': API_ENDPOINTS.CLAUDE_MESSAGES,
  'image-generations': API_ENDPOINTS.IMAGE_GENERATIONS,
}

export async function sendPlaygroundRequest<TResponse = unknown>(
  endpoint: PlaygroundEndpoint,
  payload: PlaygroundRequest
): Promise<TResponse> {
  const res = await api.post(ENDPOINT_URLS[endpoint], payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  return sendPlaygroundRequest<ChatCompletionResponse>('chat-completions', payload)
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
    endpoint: inferPlaygroundEndpoint(model),
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
