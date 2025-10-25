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
// Model CRUD Operations
// ============================================================================

/**
 * Get paginated list of models
 * @param params - Pagination and filter parameters
 * @returns Promise with models list response
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
 * @param params - Search parameters including keyword and vendor filter
 * @returns Promise with filtered models list
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
 * @param id - Model ID
 * @returns Promise with model data
 */
export async function getModel(id: number): Promise<ApiResponse<Model>> {
  const res = await api.get(`/api/models/${id}`)
  return res.data
}

/**
 * Create a new model
 * @param data - Model form data
 * @returns Promise with created model
 */
export async function createModel(
  data: ModelFormData
): Promise<ApiResponse<Model>> {
  const res = await api.post('/api/models/', data)
  return res.data
}

/**
 * Update an existing model
 * @param data - Model form data with ID
 * @returns Promise with updated model
 */
export async function updateModel(
  data: ModelFormData & { id: number }
): Promise<ApiResponse<Model>> {
  const res = await api.put('/api/models/', data)
  return res.data
}

/**
 * Delete a single model
 * @param id - Model ID to delete
 * @returns Promise with deletion result
 */
export async function deleteModel(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/models/${id}`)
  return res.data
}

/**
 * Batch delete multiple models
 * @param ids - Array of model IDs to delete
 * @returns Promise with batch deletion result and count
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

// ============================================================================
// Model Operations
// ============================================================================

/**
 * Update model status (enable/disable)
 * @param id - Model ID
 * @param status - New status (0: disabled, 1: enabled)
 * @returns Promise with updated model
 */
export async function updateModelStatus(
  id: number,
  status: number
): Promise<ApiResponse<Model>> {
  const res = await api.put('/api/models/?status_only=true', { id, status })
  return res.data
}

/**
 * Get list of missing (unconfigured) models
 * Models that have been requested but not yet configured
 * @returns Promise with array of missing model names
 */
export async function getMissingModels(): Promise<ApiResponse<string[]>> {
  const res = await api.get('/api/models/missing')
  return res.data
}

// ============================================================================
// Upstream Sync Operations
// ============================================================================

/**
 * Sync models and vendors from upstream official metadata
 * @param params - Sync parameters (locale, overwrite conflicts)
 * @returns Promise with sync result statistics
 */
export async function syncUpstream(
  params: SyncUpstreamParams = {}
): Promise<SyncUpstreamResponse> {
  const res = await api.post('/api/models/sync_upstream', params)
  return res.data
}

/**
 * Preview upstream sync differences before applying
 * Shows conflicts between local and upstream data
 * @param locale - Language locale for metadata (zh, en, ja)
 * @returns Promise with diff data including conflicts
 */
export async function previewUpstreamDiff(
  locale?: string
): Promise<UpstreamDiffResponse> {
  const url = `/api/models/sync_upstream/preview${locale ? `?locale=${locale}` : ''}`
  const res = await api.get(url)
  return res.data
}

/**
 * Apply upstream sync with conflict resolution
 * Use after previewing to resolve conflicts selectively
 * @param params - Sync parameters with overwrite field selections
 * @returns Promise with sync result statistics
 */
export async function applyUpstreamOverwrite(
  params: SyncUpstreamParams
): Promise<SyncUpstreamResponse> {
  const res = await api.post('/api/models/sync_upstream', params)
  return res.data
}

// ============================================================================
// Vendor CRUD Operations
// ============================================================================

/**
 * Get list of all vendors
 * @param params - Query parameters (pagination)
 * @returns Promise with vendors list
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
 * @param id - Vendor ID
 * @returns Promise with vendor data
 */
export async function getVendor(id: number): Promise<ApiResponse<Vendor>> {
  const res = await api.get(`/api/vendors/${id}`)
  return res.data
}

/**
 * Create a new vendor
 * @param data - Vendor form data
 * @returns Promise with created vendor
 */
export async function createVendor(
  data: VendorFormData
): Promise<ApiResponse<Vendor>> {
  const res = await api.post('/api/vendors/', data)
  return res.data
}

/**
 * Update an existing vendor
 * @param data - Vendor form data with ID
 * @returns Promise with updated vendor
 */
export async function updateVendor(
  data: VendorFormData & { id: number }
): Promise<ApiResponse<Vendor>> {
  const res = await api.put('/api/vendors/', data)
  return res.data
}

/**
 * Delete a single vendor
 * @param id - Vendor ID to delete
 * @returns Promise with deletion result
 */
export async function deleteVendor(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/vendors/${id}`)
  return res.data
}

// ============================================================================
// Prefill Group CRUD Operations
// ============================================================================

/**
 * Get list of prefill groups
 * Used for quick-filling model tags and endpoints
 * @param params - Filter parameters (type: model/tag/endpoint)
 * @returns Promise with prefill groups array
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
 * @param id - Prefill group ID
 * @returns Promise with prefill group data
 */
export async function getPrefillGroup(
  id: number
): Promise<ApiResponse<PrefillGroup>> {
  const res = await api.get(`/api/prefill_group/${id}`)
  return res.data
}

/**
 * Create a new prefill group
 * @param data - Prefill group form data
 * @returns Promise with created prefill group
 */
export async function createPrefillGroup(
  data: PrefillGroupFormData
): Promise<ApiResponse<PrefillGroup>> {
  const res = await api.post('/api/prefill_group', data)
  return res.data
}

/**
 * Update an existing prefill group
 * @param data - Prefill group form data with ID
 * @returns Promise with updated prefill group
 */
export async function updatePrefillGroup(
  data: PrefillGroupFormData & { id: number }
): Promise<ApiResponse<PrefillGroup>> {
  const res = await api.put('/api/prefill_group', data)
  return res.data
}

/**
 * Delete a single prefill group
 * @param id - Prefill group ID to delete
 * @returns Promise with deletion result
 */
export async function deletePrefillGroup(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/prefill_group/${id}`)
  return res.data
}
