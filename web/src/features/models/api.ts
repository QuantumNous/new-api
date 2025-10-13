import { api } from '@/lib/api'
import type {
  ApiResponse,
  GetModelsParams,
  GetModelsResponse,
  SearchModelsParams,
  Model,
  ModelFormData,
  Vendor,
  VendorFormData,
  GetVendorsParams,
  PrefillGroup,
  PrefillGroupFormData,
  GetPrefillGroupsParams,
  SyncUpstreamParams,
  SyncUpstreamResponse,
  UpstreamDiffResponse,
} from './types'

// ============================================================================
// Model APIs
// ============================================================================

/**
 * Get paginated models list
 */
export async function getModels(
  params: GetModelsParams = {}
): Promise<GetModelsResponse> {
  const { p = 1, page_size = 10, vendor } = params

  let url = `/api/models/?p=${p}&page_size=${page_size}`
  if (vendor && vendor !== 'all') {
    url = `/api/models/search?vendor=${vendor}&p=${p}&page_size=${page_size}`
  }

  const res = await api.get(url)
  return res.data
}

/**
 * Search models by keyword and vendor
 */
export async function searchModels(
  params: SearchModelsParams
): Promise<GetModelsResponse> {
  const { keyword = '', vendor = '', p = 1, page_size = 10 } = params
  const res = await api.get(
    `/api/models/search?keyword=${keyword}&vendor=${vendor}&p=${p}&page_size=${page_size}`
  )
  return res.data
}

/**
 * Get single model by ID
 */
export async function getModel(id: number): Promise<ApiResponse<Model>> {
  const res = await api.get(`/api/models/${id}`)
  return res.data
}

/**
 * Create a new model
 */
export async function createModel(
  data: ModelFormData
): Promise<ApiResponse<Model>> {
  const res = await api.post('/api/models/', data)
  return res.data
}

/**
 * Update an existing model
 */
export async function updateModel(
  data: ModelFormData & { id: number }
): Promise<ApiResponse<Model>> {
  const res = await api.put('/api/models/', data)
  return res.data
}

/**
 * Delete a single model
 */
export async function deleteModel(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/models/${id}`)
  return res.data
}

/**
 * Batch delete multiple models
 */
export async function batchDeleteModels(
  ids: number[]
): Promise<ApiResponse<number>> {
  const deletePromises = ids.map((id) => deleteModel(id))
  const results = await Promise.all(deletePromises)

  const successCount = results.filter((r) => r.success).length
  const success = successCount > 0

  return {
    success,
    message: success
      ? `Successfully deleted ${successCount} model${successCount > 1 ? 's' : ''}`
      : 'Failed to delete models',
    data: successCount,
  }
}

/**
 * Update model status (enable/disable)
 */
export async function updateModelStatus(
  id: number,
  status: number
): Promise<ApiResponse<Model>> {
  const res = await api.put('/api/models/?status_only=true', { id, status })
  return res.data
}

/**
 * Get missing (unconfigured) models
 */
export async function getMissingModels(): Promise<ApiResponse<string[]>> {
  const res = await api.get('/api/models/missing')
  return res.data
}

/**
 * Sync upstream models/vendors
 */
export async function syncUpstream(
  params: SyncUpstreamParams = {}
): Promise<SyncUpstreamResponse> {
  const res = await api.post('/api/models/sync_upstream', params)
  return res.data
}

/**
 * Preview upstream sync differences
 */
export async function previewUpstreamDiff(
  locale?: string
): Promise<UpstreamDiffResponse> {
  const url = `/api/models/sync_upstream/preview${locale ? `?locale=${locale}` : ''}`
  const res = await api.get(url)
  return res.data
}

/**
 * Apply upstream overwrite with selected conflicts
 */
export async function applyUpstreamOverwrite(
  params: SyncUpstreamParams
): Promise<SyncUpstreamResponse> {
  const res = await api.post('/api/models/sync_upstream', params)
  return res.data
}

// ============================================================================
// Vendor APIs
// ============================================================================

/**
 * Get vendors list
 */
export async function getVendors(
  params: GetVendorsParams = {}
): Promise<ApiResponse<{ items: Vendor[] }>> {
  const { page_size = 1000 } = params
  const res = await api.get(`/api/vendors/?page_size=${page_size}`)
  return res.data
}

/**
 * Get single vendor by ID
 */
export async function getVendor(id: number): Promise<ApiResponse<Vendor>> {
  const res = await api.get(`/api/vendors/${id}`)
  return res.data
}

/**
 * Create a new vendor
 */
export async function createVendor(
  data: VendorFormData
): Promise<ApiResponse<Vendor>> {
  const res = await api.post('/api/vendors/', data)
  return res.data
}

/**
 * Update an existing vendor
 */
export async function updateVendor(
  data: VendorFormData & { id: number }
): Promise<ApiResponse<Vendor>> {
  const res = await api.put('/api/vendors/', data)
  return res.data
}

/**
 * Delete a single vendor
 */
export async function deleteVendor(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/vendors/${id}`)
  return res.data
}

// ============================================================================
// Prefill Group APIs
// ============================================================================

/**
 * Get prefill groups list
 */
export async function getPrefillGroups(
  params: GetPrefillGroupsParams = {}
): Promise<ApiResponse<PrefillGroup[]>> {
  const { type } = params
  const url = type ? `/api/prefill_group?type=${type}` : '/api/prefill_group'
  const res = await api.get(url)
  return res.data
}

/**
 * Get single prefill group by ID
 */
export async function getPrefillGroup(
  id: number
): Promise<ApiResponse<PrefillGroup>> {
  const res = await api.get(`/api/prefill_group/${id}`)
  return res.data
}

/**
 * Create a new prefill group
 */
export async function createPrefillGroup(
  data: PrefillGroupFormData
): Promise<ApiResponse<PrefillGroup>> {
  const res = await api.post('/api/prefill_group', data)
  return res.data
}

/**
 * Update an existing prefill group
 */
export async function updatePrefillGroup(
  data: PrefillGroupFormData & { id: number }
): Promise<ApiResponse<PrefillGroup>> {
  const res = await api.put('/api/prefill_group', data)
  return res.data
}

/**
 * Delete a single prefill group
 */
export async function deletePrefillGroup(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/prefill_group/${id}`)
  return res.data
}
