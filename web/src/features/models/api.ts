import { api } from '@/lib/api'
import type {
  GetModelsParams,
  GetModelsResponse,
  GetModelResponse,
  GetVendorsResponse,
  GetVendorResponse,
  Model,
  Vendor,
  SearchModelsParams,
  SyncUpstreamResponse,
  PreviewUpstreamDiffResponse,
  MissingModelsResponse,
  PrefillGroupsResponse,
  SyncLocale,
  SyncSource,
  SyncOverwritePayload,
} from './types'

// ============================================================================
// Model CRUD Operations
// ============================================================================

/**
 * Get paginated list of models
 */
export async function getModels(
  params: GetModelsParams = {}
): Promise<GetModelsResponse> {
  const res = await api.get('/api/models/', { params })
  return res.data
}

/**
 * Search models with filters
 */
export async function searchModels(
  params: SearchModelsParams
): Promise<GetModelsResponse> {
  const res = await api.get('/api/models/search', { params })
  return res.data
}

/**
 * Get single model by ID
 */
export async function getModel(id: number): Promise<GetModelResponse> {
  const res = await api.get(`/api/models/${id}`)
  return res.data
}

/**
 * Create new model
 */
export async function createModel(
  data: Partial<Model>
): Promise<{ success: boolean; message?: string; data?: Model }> {
  const res = await api.post('/api/models/', data)
  return res.data
}

/**
 * Update existing model
 */
export async function updateModel(
  data: Partial<Model> & { id: number }
): Promise<{ success: boolean; message?: string; data?: Model }> {
  const res = await api.put('/api/models/', data)
  return res.data
}

/**
 * Update model status only
 */
export async function updateModelStatus(
  id: number,
  status: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/models/?status_only=true', { id, status })
  return res.data
}

/**
 * Delete model
 */
export async function deleteModel(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/models/${id}`)
  return res.data
}

// ============================================================================
// Vendor Management
// ============================================================================

/**
 * Get paginated list of vendors
 */
export async function getVendors(params?: {
  p?: number
  page_size?: number
}): Promise<GetVendorsResponse> {
  const res = await api.get('/api/vendors/', {
    params: params || { page_size: 1000 },
  })
  return res.data
}

/**
 * Search vendors
 */
export async function searchVendors(params: {
  keyword?: string
  p?: number
  page_size?: number
}): Promise<GetVendorsResponse> {
  const res = await api.get('/api/vendors/search', { params })
  return res.data
}

/**
 * Get single vendor by ID
 */
export async function getVendor(id: number): Promise<GetVendorResponse> {
  const res = await api.get(`/api/vendors/${id}`)
  return res.data
}

/**
 * Create new vendor
 */
export async function createVendor(
  data: Partial<Vendor>
): Promise<{ success: boolean; message?: string; data?: Vendor }> {
  const res = await api.post('/api/vendors/', data)
  return res.data
}

/**
 * Update existing vendor
 */
export async function updateVendor(
  data: Partial<Vendor> & { id: number }
): Promise<{ success: boolean; message?: string; data?: Vendor }> {
  const res = await api.put('/api/vendors/', data)
  return res.data
}

/**
 * Delete vendor
 */
export async function deleteVendor(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/vendors/${id}`)
  return res.data
}

// ============================================================================
// Sync Operations
// ============================================================================

/**
 * Sync upstream models (missing only or with overwrite)
 */
export async function syncUpstream(params?: {
  locale?: SyncLocale
  source?: SyncSource
  overwrite?: SyncOverwritePayload[]
}): Promise<SyncUpstreamResponse> {
  const res = await api.post('/api/models/sync_upstream', params)
  return res.data
}

/**
 * Preview upstream diff
 */
export async function previewUpstreamDiff(params?: {
  locale?: SyncLocale
  source?: SyncSource
}): Promise<PreviewUpstreamDiffResponse> {
  const searchParams = new URLSearchParams()
  if (params?.locale) {
    searchParams.set('locale', params.locale)
  }
  if (params?.source) {
    searchParams.set('source', params.source)
  }
  const queryString = searchParams.toString()
  const url = queryString
    ? `/api/models/sync_upstream/preview?${queryString}`
    : '/api/models/sync_upstream/preview'
  const res = await api.get(url)
  return res.data
}

/**
 * Apply upstream overwrite
 */
export async function applyUpstreamOverwrite(params: {
  overwrite: SyncOverwritePayload[]
  locale?: SyncLocale
  source?: SyncSource
}): Promise<SyncUpstreamResponse> {
  return syncUpstream(params)
}

// ============================================================================
// Utility Operations
// ============================================================================

/**
 * Get missing models (used but not configured)
 */
export async function getMissingModels(): Promise<MissingModelsResponse> {
  const res = await api.get('/api/models/missing')
  return res.data
}

/**
 * Get prefill groups
 */
export async function getPrefillGroups(
  type?: 'model' | 'tag' | 'endpoint'
): Promise<PrefillGroupsResponse> {
  const res = await api.get('/api/prefill_group', {
    params: type ? { type } : undefined,
  })
  return res.data
}

/**
 * Create prefill group
 */
export async function createPrefillGroup(data: {
  name: string
  type: 'model' | 'tag' | 'endpoint'
  items: string | string[]
  description?: string
}): Promise<{ success: boolean; message?: string }> {
  const res = await api.post('/api/prefill_group', data)
  return res.data
}

/**
 * Update prefill group
 */
export async function updatePrefillGroup(data: {
  id: number
  type?: 'model' | 'tag' | 'endpoint'
  name?: string
  items?: string | string[]
  description?: string
}): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/prefill_group', data)
  return res.data
}

/**
 * Delete prefill group
 */
export async function deletePrefillGroup(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/prefill_group/${id}`)
  return res.data
}
