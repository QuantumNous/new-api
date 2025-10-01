import { api } from '@/lib/api'
import type { ApiKey } from './data/schema'

// ============================================================================
// Type Definitions
// ============================================================================

export interface GetApiKeysParams {
  p?: number
  size?: number
}

export interface GetApiKeysResponse {
  success: boolean
  message?: string
  data?: {
    items: ApiKey[]
    total: number
    page: number
    page_size: number
  }
}

export interface SearchApiKeysParams {
  keyword?: string
  token?: string
}

export interface ApiKeyFormData {
  id?: number
  name: string
  remain_quota: number
  expired_time: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits: string
  allow_ips: string
  group: string
  tokenCount?: number
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
  return res.data
}

// Search API keys by keyword or token
export async function searchApiKeys(
  params: SearchApiKeysParams
): Promise<{ success: boolean; message?: string; data?: ApiKey[] }> {
  const { keyword = '', token = '' } = params
  const res = await api.get(
    `/api/token/search?keyword=${keyword}&token=${token}`
  )
  return res.data
}

// Get single API key by ID
export async function getApiKey(
  id: number
): Promise<{ success: boolean; message?: string; data?: ApiKey }> {
  const res = await api.get(`/api/token/${id}`)
  return res.data
}

// Create a new API key
export async function createApiKey(
  data: ApiKeyFormData
): Promise<{ success: boolean; message?: string; data?: ApiKey }> {
  const res = await api.post('/api/token/', data)
  return res.data
}

// Update an existing API key
export async function updateApiKey(
  data: ApiKeyFormData & { id: number }
): Promise<{ success: boolean; message?: string; data?: ApiKey }> {
  const res = await api.put('/api/token/', data)
  return res.data
}

// Delete a single API key
export async function deleteApiKey(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/token/${id}/`)
  return res.data
}

// Batch delete multiple API keys
export async function batchDeleteApiKeys(
  ids: number[]
): Promise<{ success: boolean; message?: string; data?: number }> {
  const res = await api.post('/api/token/batch', { ids })
  return res.data
}

// Update API key status (enable/disable)
export async function updateApiKeyStatus(
  id: number,
  status: number
): Promise<{ success: boolean; message?: string; data?: ApiKey }> {
  const res = await api.put('/api/token/?status_only=true', { id, status })
  return res.data
}
