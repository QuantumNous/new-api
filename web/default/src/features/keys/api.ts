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

import {
  apiKeySchema,
  type ApiKey,
  type ApiResponse,
  type GetApiKeysParams,
  type GetApiKeysResponse,
  type SearchApiKeysParams,
  type ApiKeyFormData,
} from './types'

function normalizeApiKey(value: unknown): ApiKey {
  return apiKeySchema.parse(value)
}

function normalizeApiKeysResponse(
  response: GetApiKeysResponse
): GetApiKeysResponse {
  if (!response.data) return response

  return {
    ...response,
    data: {
      ...response.data,
      items: response.data.items.map(normalizeApiKey),
    },
  }
}

function normalizeApiKeyResponse(
  response: ApiResponse<ApiKey>
): ApiResponse<ApiKey> {
  if (!response.data) return response

  return {
    ...response,
    data: normalizeApiKey(response.data),
  }
}

const API_KEY_TEST_ENDPOINTS = [
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
  'jina-rerank',
  'image-generation',
  'embeddings',
] as const

const API_KEY_TEST_ENDPOINT_SET = new Set<string>(API_KEY_TEST_ENDPOINTS)
const MODEL_LIST_TIMEOUT_MS = 15_000
const MODEL_TEST_TIMEOUT_MS = 60_000
const RESPONSE_PREVIEW_MAX_LENGTH = 240

export type ApiKeyTestEndpoint = (typeof API_KEY_TEST_ENDPOINTS)[number]

export type ApiKeyModel = {
  id: string
  ownedBy?: string
  supportedEndpointTypes: ApiKeyTestEndpoint[]
}

const DEFAULT_API_KEY_TEST_MODELS = ['gpt-5.6-sol', 'claude-opus-4-8'] as const

export function selectApiKeyTestModel(
  models: ApiKeyModel[],
  selectedModelId = '',
  apiKey?: Pick<ApiKey, 'group' | 'name'> | null
): ApiKeyModel | undefined {
  const selectedModel = models.find((model) => model.id === selectedModelId)
  if (selectedModel) return selectedModel

  const groupHint = apiKey?.group?.toLowerCase() ?? ''
  const nameHint = apiKey?.name.toLowerCase() ?? ''
  const groupIdentifiesOpenAI =
    groupHint.includes('openai') || groupHint.includes('codex')
  const prefersClaude =
    groupHint.includes('claude') ||
    groupHint.includes('anthropic') ||
    (!groupIdentifiesOpenAI &&
      (nameHint.includes('claude') || nameHint.includes('anthropic')))
  const preferredModelIds = prefersClaude
    ? [...DEFAULT_API_KEY_TEST_MODELS].reverse()
    : DEFAULT_API_KEY_TEST_MODELS

  for (const preferredModelId of preferredModelIds) {
    const preferredModel = models.find(
      (model) =>
        model.id === preferredModelId && model.supportedEndpointTypes.length > 0
    )
    if (preferredModel) return preferredModel
  }

  return (
    models.find((model) => model.supportedEndpointTypes.length > 0) ?? models[0]
  )
}

export type ApiKeyRequestFailureKind =
  | 'api'
  | 'invalid-response'
  | 'network'
  | 'timeout'

type ApiKeyRequestFailure = {
  success: false
  failureKind: ApiKeyRequestFailureKind
  message?: string
  requestId?: string
  responseTime?: number
  status?: number
}

export type ApiKeyModelsResult =
  | { success: true; models: ApiKeyModel[] }
  | ApiKeyRequestFailure

export type ApiKeyModelTestResult =
  | {
      success: true
      endpointPath: string
      endpointType: ApiKeyTestEndpoint
      preview?: string
      requestId?: string
      responseTime: number
    }
  | (ApiKeyRequestFailure & {
      endpointPath: string
      endpointType: ApiKeyTestEndpoint
    })

type ApiKeyHttpSuccess = {
  success: true
  payload: unknown
  requestId?: string
  responseTime: number
  status: number
}

type ApiKeyTestRequest = {
  body: unknown
  endpointPath: string
  headers?: Record<string, string>
  url: URL
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function getApiErrorMessage(payload: unknown): string | undefined {
  const record = asRecord(payload)
  if (!record) return undefined

  const error = record.error
  if (typeof error === 'string' && error.trim()) return error.trim()

  const errorRecord = asRecord(error)
  if (typeof errorRecord?.message === 'string' && errorRecord.message.trim()) {
    return errorRecord.message.trim()
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim()
  }

  return undefined
}

function getRequestId(response: Response): string | undefined {
  for (const header of [
    'x-oneapi-request-id',
    'x-request-id',
    'request-id',
    'openai-request-id',
    'cf-ray',
  ]) {
    const value = response.headers.get(header)?.trim()
    if (value) return value
  }

  return undefined
}

async function requestApiKeyEndpoint(
  url: URL,
  init: RequestInit,
  timeoutMs: number
): Promise<ApiKeyHttpSuccess | ApiKeyRequestFailure> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    const responseTime = Math.max(1, Math.round(performance.now() - startedAt))
    const requestId = getRequestId(response)
    const payloadRecord = asRecord(payload)
    const hasBusinessError =
      payloadRecord?.success === false || payloadRecord?.error != null

    if (!response.ok || hasBusinessError) {
      return {
        success: false,
        failureKind: 'api',
        message:
          getApiErrorMessage(payload) ||
          (response.ok ? undefined : `HTTP ${response.status}`),
        requestId,
        responseTime,
        status: response.status,
      }
    }

    if (payload === null) {
      return {
        success: false,
        failureKind: 'invalid-response',
        requestId,
        responseTime,
        status: response.status,
      }
    }

    return {
      success: true,
      payload,
      requestId,
      responseTime,
      status: response.status,
    }
  } catch (error) {
    const responseTime = Math.max(1, Math.round(performance.now() - startedAt))
    const isAbortError =
      error instanceof DOMException && error.name === 'AbortError'

    return {
      success: false,
      failureKind: isAbortError ? 'timeout' : 'network',
      responseTime,
    }
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

function parseApiKeyModel(value: unknown): ApiKeyModel | null {
  if (typeof value === 'string') {
    const id = value.trim()
    if (!id) return null
    return { id, supportedEndpointTypes: ['openai'] }
  }

  const record = asRecord(value)
  if (!record || typeof record.id !== 'string' || !record.id.trim()) {
    return null
  }

  const rawEndpointTypes = record.supported_endpoint_types
  const supportedEndpointTypes = Array.isArray(rawEndpointTypes)
    ? rawEndpointTypes.filter(
        (endpoint): endpoint is ApiKeyTestEndpoint =>
          typeof endpoint === 'string' &&
          API_KEY_TEST_ENDPOINT_SET.has(endpoint)
      )
    : (['openai'] as ApiKeyTestEndpoint[])

  return {
    id: record.id.trim(),
    ownedBy:
      typeof record.owned_by === 'string' && record.owned_by.trim()
        ? record.owned_by.trim()
        : undefined,
    supportedEndpointTypes: [...new Set(supportedEndpointTypes)],
  }
}

function normalizePreview(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.replaceAll(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  if (normalized.length <= RESPONSE_PREVIEW_MAX_LENGTH) return normalized
  return `${normalized.slice(0, RESPONSE_PREVIEW_MAX_LENGTH).trimEnd()}...`
}

function getResponsePreview(payload: unknown): string | undefined {
  const record = asRecord(payload)
  if (!record) return undefined

  const outputText = normalizePreview(record.output_text)
  if (outputText) return outputText

  if (Array.isArray(record.choices)) {
    const firstChoice = asRecord(record.choices[0])
    const message = asRecord(firstChoice?.message)
    const choiceText =
      normalizePreview(message?.content) || normalizePreview(firstChoice?.text)
    if (choiceText) return choiceText
  }

  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      const contentText = normalizePreview(asRecord(item)?.text)
      if (contentText) return contentText
    }
  }

  if (Array.isArray(record.output)) {
    for (const outputItem of record.output) {
      const outputRecord = asRecord(outputItem)
      if (!Array.isArray(outputRecord?.content)) continue

      for (const contentItem of outputRecord.content) {
        const contentText = normalizePreview(asRecord(contentItem)?.text)
        if (contentText) return contentText
      }
    }
  }

  if (Array.isArray(record.candidates)) {
    const firstCandidate = asRecord(record.candidates[0])
    const content = asRecord(firstCandidate?.content)
    if (Array.isArray(content?.parts)) {
      for (const part of content.parts) {
        const partText = normalizePreview(asRecord(part)?.text)
        if (partText) return partText
      }
    }
  }

  return undefined
}

function hasNonEmptyObjectArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => asRecord(item) !== null)
}

function hasTextContent(value: unknown): boolean {
  if (normalizePreview(value)) return true
  if (!Array.isArray(value)) return false

  return value.some((item) => normalizePreview(asRecord(item)?.text) != null)
}

function isValidApiKeyTestResponse(
  endpointType: ApiKeyTestEndpoint,
  payload: unknown
): boolean {
  const record = asRecord(payload)
  if (!record) return false

  switch (endpointType) {
    case 'openai':
      return (
        Array.isArray(record.choices) &&
        record.choices.some((choice) => {
          const choiceRecord = asRecord(choice)
          if (!choiceRecord) return false

          const message = asRecord(choiceRecord.message)
          return (
            hasTextContent(message?.content) ||
            normalizePreview(choiceRecord.text) != null
          )
        })
      )
    case 'openai-response':
    case 'openai-response-compact':
      return (
        normalizePreview(record.output_text) != null ||
        hasNonEmptyObjectArray(record.output)
      )
    case 'anthropic':
      return hasNonEmptyObjectArray(record.content)
    case 'gemini':
      return hasNonEmptyObjectArray(record.candidates)
    case 'jina-rerank':
      return hasNonEmptyObjectArray(record.results)
    case 'image-generation':
    case 'embeddings':
      return hasNonEmptyObjectArray(record.data)
  }
}

function buildApiKeyTestRequest(
  apiBaseUrl: string,
  model: string,
  endpointType: ApiKeyTestEndpoint
): ApiKeyTestRequest {
  const normalizedBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '')
  const prompt = 'Reply with OK.'

  switch (endpointType) {
    case 'openai': {
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }
      if (/^(o1|o3|o4)/.test(model)) {
        body.max_completion_tokens = 16
      } else if (model.includes('gemini')) {
        body.max_tokens = 3000
      } else if (model.includes('thinking') && !model.includes('claude')) {
        body.max_tokens = 50
      } else {
        body.max_tokens = 16
      }
      return {
        body,
        endpointPath: '/v1/chat/completions',
        url: new URL(`${normalizedBaseUrl}/chat/completions`),
      }
    }
    case 'openai-response':
      return {
        body: {
          model,
          input: [{ role: 'user', content: prompt }],
          max_output_tokens: 16,
          stream: false,
        },
        endpointPath: '/v1/responses',
        url: new URL(`${normalizedBaseUrl}/responses`),
      }
    case 'openai-response-compact':
      return {
        body: { model, input: [{ role: 'user', content: prompt }] },
        endpointPath: '/v1/responses/compact',
        url: new URL(`${normalizedBaseUrl}/responses/compact`),
      }
    case 'anthropic':
      return {
        body: {
          model,
          max_tokens: 16,
          messages: [{ role: 'user', content: prompt }],
        },
        endpointPath: '/v1/messages',
        headers: { 'anthropic-version': '2023-06-01' },
        url: new URL(`${normalizedBaseUrl}/messages`),
      }
    case 'gemini': {
      const url = new URL(normalizedBaseUrl)
      const rootPath = url.pathname.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
      url.pathname = `${rootPath}/v1beta/models/${encodeURIComponent(model)}:generateContent`
      return {
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 3000 },
        },
        endpointPath: `/v1beta/models/${model}:generateContent`,
        url,
      }
    }
    case 'jina-rerank':
      return {
        body: {
          model,
          query: 'What is deep learning?',
          documents: [
            'Deep learning is a subset of machine learning.',
            'Machine learning is a field of artificial intelligence.',
          ],
          top_n: 1,
        },
        endpointPath: '/v1/rerank',
        url: new URL(`${normalizedBaseUrl}/rerank`),
      }
    case 'image-generation':
      return {
        body: {
          model,
          prompt: 'A solid black square.',
          n: 1,
          size: '1024x1024',
        },
        endpointPath: '/v1/images/generations',
        url: new URL(`${normalizedBaseUrl}/images/generations`),
      }
    case 'embeddings':
      return {
        body: { model, input: ['hello world'] },
        endpointPath: '/v1/embeddings',
        url: new URL(`${normalizedBaseUrl}/embeddings`),
      }
  }
}

// ============================================================================
// API Key Management
// ============================================================================

// Get paginated API keys list
export async function getApiKeys(
  params: GetApiKeysParams = {}
): Promise<GetApiKeysResponse> {
  const { p = 1, size = 10 } = params
  const res = await api.get(`/api/token/?p=${p}&size=${size}`)
  return normalizeApiKeysResponse(res.data)
}

// Search API keys by keyword or token (with pagination)
export async function searchApiKeys(
  params: SearchApiKeysParams
): Promise<GetApiKeysResponse> {
  const { keyword = '', token = '', p, size } = params
  const queryParams = new URLSearchParams()
  if (keyword) queryParams.set('keyword', keyword)
  if (token) queryParams.set('token', token)
  if (p != null) queryParams.set('p', String(p))
  if (size != null) queryParams.set('size', String(size))
  const res = await api.get(`/api/token/search?${queryParams.toString()}`)
  return normalizeApiKeysResponse(res.data)
}

// Get single API key by ID
export async function getApiKey(id: number): Promise<ApiResponse<ApiKey>> {
  const res = await api.get(`/api/token/${id}`)
  return normalizeApiKeyResponse(res.data)
}

// Create a new API key
export async function createApiKey(
  data: ApiKeyFormData
): Promise<ApiResponse<ApiKey>> {
  const res = await api.post('/api/token/', data)
  return normalizeApiKeyResponse(res.data)
}

// Update an existing API key
export async function updateApiKey(
  data: ApiKeyFormData & { id: number }
): Promise<ApiResponse<ApiKey>> {
  const res = await api.put('/api/token/', data)
  return normalizeApiKeyResponse(res.data)
}

// Delete a single API key
export async function deleteApiKey(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/token/${id}/`)
  return res.data
}

// Batch delete multiple API keys
export async function batchDeleteApiKeys(
  ids: number[]
): Promise<ApiResponse<number>> {
  const res = await api.post('/api/token/batch', { ids })
  return res.data
}

// Update API key status (enable/disable)
export async function updateApiKeyStatus(
  id: number,
  status: number
): Promise<ApiResponse<ApiKey>> {
  const res = await api.put('/api/token/?status_only=true', { id, status })
  return normalizeApiKeyResponse(res.data)
}

// Fetch the real (unmasked) key for a token by ID
export async function fetchTokenKey(
  id: number
): Promise<{ success: boolean; message?: string; data?: { key: string } }> {
  const res = await api.post(`/api/token/${id}/key`)
  return res.data
}

// Batch fetch real (unmasked) keys for multiple tokens
export async function fetchTokenKeysBatch(ids: number[]): Promise<{
  success: boolean
  message?: string
  data?: { keys: Record<number, string> }
}> {
  const res = await api.post('/api/token/batch/keys', { ids })
  return res.data
}

// Use credential-free public relay requests so API-key failures do not pass
// through the dashboard client's authentication interceptor.
export async function fetchApiKeyModels(
  apiBaseUrl: string,
  apiKey: string
): Promise<ApiKeyModelsResult> {
  const normalizedBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '')
  if (!normalizedBaseUrl) {
    return { success: false, failureKind: 'invalid-response' }
  }

  try {
    const modelsUrl = new URL(`${normalizedBaseUrl}/models`)
    const result = await requestApiKeyEndpoint(
      modelsUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
      MODEL_LIST_TIMEOUT_MS
    )
    if (!result.success) return result

    const payload = asRecord(result.payload)
    if (payload?.object !== 'list' || !Array.isArray(payload.data)) {
      return {
        success: false,
        failureKind: 'invalid-response',
        requestId: result.requestId,
        responseTime: result.responseTime,
      }
    }

    const modelsById = new Map<string, ApiKeyModel>()
    for (const value of payload.data) {
      const model = parseApiKeyModel(value)
      if (model && !modelsById.has(model.id)) {
        modelsById.set(model.id, model)
      }
    }

    return { success: true, models: [...modelsById.values()] }
  } catch {
    return { success: false, failureKind: 'invalid-response' }
  }
}

export async function testApiKeyModel(
  apiBaseUrl: string,
  apiKey: string,
  model: string,
  endpointType: ApiKeyTestEndpoint
): Promise<ApiKeyModelTestResult> {
  let request: ApiKeyTestRequest
  try {
    request = buildApiKeyTestRequest(apiBaseUrl, model, endpointType)
  } catch {
    return {
      success: false,
      failureKind: 'invalid-response',
      endpointPath: '',
      endpointType,
    }
  }

  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  })
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    headers.set(name, value)
  }

  const result = await requestApiKeyEndpoint(
    request.url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(request.body),
    },
    MODEL_TEST_TIMEOUT_MS
  )
  if (!result.success) {
    return {
      ...result,
      endpointPath: request.endpointPath,
      endpointType,
    }
  }

  if (!isValidApiKeyTestResponse(endpointType, result.payload)) {
    return {
      success: false,
      failureKind: 'invalid-response',
      endpointPath: request.endpointPath,
      endpointType,
      requestId: result.requestId,
      responseTime: result.responseTime,
      status: result.status,
    }
  }

  return {
    success: true,
    endpointPath: request.endpointPath,
    endpointType,
    preview: getResponsePreview(result.payload),
    requestId: result.requestId,
    responseTime: result.responseTime,
  }
}
