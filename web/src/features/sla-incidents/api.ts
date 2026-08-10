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
*/
import { api } from '@/lib/api'

import type {
  ApiResponse,
  ListSlaIncidentsParams,
  ListSlaIncidentsResponse,
  PublicSlaIncidentsResponse,
  PublicSlaStatusResponse,
  SlaIncident,
  SlaIncidentFormData,
  SlaStatusSummary,
} from './types'

// ============================================================================
// SLA Incident Management (admin)
// ============================================================================

export async function listSlaIncidents(
  params: ListSlaIncidentsParams = {}
): Promise<ListSlaIncidentsResponse> {
  const queryParams = new URLSearchParams()
  queryParams.set('page', String(params.page ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  if (params.status) queryParams.set('status', params.status)
  const res = await api.get(
    `/api/admin/sla-incidents?${queryParams.toString()}`
  )
  return res.data
}

export async function getSlaIncident(
  id: number
): Promise<ApiResponse<SlaIncident>> {
  const res = await api.get(`/api/admin/sla-incidents/${id}`)
  return res.data
}

export async function createSlaIncident(
  data: SlaIncidentFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post('/api/admin/sla-incidents', data)
  return res.data
}

export async function updateSlaIncident(
  id: number,
  data: SlaIncidentFormData
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.put(`/api/admin/sla-incidents/${id}`, data)
  return res.data
}

export async function deleteSlaIncident(
  id: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/sla-incidents/${id}`)
  return res.data
}

// ============================================================================
// SLA Public Status (no auth)
// ============================================================================

export async function getPublicSlaIncidents(): Promise<PublicSlaIncidentsResponse> {
  const res = await api.get('/api/sla/incidents')
  return res.data
}

export async function getPublicSlaStatus(
  windowHours?: number
): Promise<PublicSlaStatusResponse> {
  const queryParams = new URLSearchParams()
  if (windowHours) queryParams.set('window_hours', String(windowHours))
  const res = await api.get(
    `/api/sla/status?${queryParams.toString()}`
  )
  return res.data
}

export type { SlaStatusSummary }
