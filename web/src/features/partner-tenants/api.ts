/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'

export interface PartnerTenant {
  id: number
  name: string
  group: string
  status: 1 | 2
  created_at: number
  updated_at: number
}

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success) throw new Error(response.message || fallback)
  return response.data as T
}

export async function listPartnerTenants(): Promise<PartnerTenant[]> {
  const res = await api.get('/api/partner-tenants')
  return unwrap(res.data, 'Failed to load partner tenants')
}

export async function createPartnerTenant(
  input: { name: string; group: string },
  proofToken: string
): Promise<{ tenant: PartnerTenant; secret: string }> {
  const res = await api.post('/api/partner-tenants', input, {
    headers: { 'X-Security-Proof': proofToken },
    singleUseAuthorization: true,
  })
  return unwrap(res.data, 'Failed to create partner tenant')
}

export async function rotatePartnerTenantSecret(
  id: number,
  proofToken: string
): Promise<{ secret: string }> {
  const res = await api.post(`/api/partner-tenants/${id}/secret`, undefined, {
    headers: { 'X-Security-Proof': proofToken },
    singleUseAuthorization: true,
  })
  return unwrap(res.data, 'Failed to rotate partner server secret')
}

export async function updatePartnerTenantStatus(
  id: number,
  status: 1 | 2
): Promise<void> {
  const res = await api.patch(`/api/partner-tenants/${id}/status`, { status })
  unwrap(res.data, 'Failed to update partner tenant')
}
