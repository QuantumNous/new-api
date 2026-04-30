import { api } from '@/lib/api'
import type { CustomOAuthProvider, DiscoveryResponse } from './types'

// ============================================================================
// Response Types
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

// ============================================================================
// Custom OAuth Provider APIs
// ============================================================================

export async function getCustomOAuthProviders(): Promise<
  ApiResponse<CustomOAuthProvider[]>
> {
  const res = await api.get('/api/custom-oauth-provider/')
  return res.data
}

export async function getCustomOAuthProvider(
  id: number
): Promise<ApiResponse<CustomOAuthProvider>> {
  const res = await api.get(`/api/custom-oauth-provider/${id}`)
  return res.data
}

export async function createCustomOAuthProvider(
  data: Omit<CustomOAuthProvider, 'id'>
): Promise<ApiResponse<CustomOAuthProvider>> {
  const res = await api.post('/api/custom-oauth-provider/', data)
  return res.data
}

export async function updateCustomOAuthProvider(
  id: number,
  data: Partial<CustomOAuthProvider>
): Promise<ApiResponse<CustomOAuthProvider>> {
  const res = await api.put(`/api/custom-oauth-provider/${id}`, data)
  return res.data
}

export async function deleteCustomOAuthProvider(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/custom-oauth-provider/${id}`)
  return res.data
}

export async function discoverOIDCEndpoints(
  wellKnownUrl: string
): Promise<DiscoveryResponse> {
  const res = await api.post('/api/custom-oauth-provider/discovery', {
    well_known_url: wellKnownUrl,
  })
  return res.data
}
