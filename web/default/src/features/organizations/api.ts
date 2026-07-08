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

import type {
  ApiResponse,
  MemberPayload,
  Organization,
  OrganizationDimensionRow,
  OrganizationListParams,
  OrganizationMember,
  OrganizationPayload,
  OrganizationSelf,
  OrganizationSummary,
  OrganizationTrendRow,
  OrganizationUsageParams,
  OrganizationUsageRow,
  PaginatedResponse,
} from './types'

function buildQuery(params: object) {
  const query = new URLSearchParams()
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    query.set(key, String(value))
  })
  return query.toString()
}

export const organizationKeys = {
  self: ['organization', 'self'] as const,
  members: (includeHistory: boolean) =>
    ['organization', 'members', includeHistory] as const,
  summary: (params: OrganizationUsageParams) =>
    ['organization', 'billing', 'summary', params] as const,
  logs: (params: OrganizationUsageParams) =>
    ['organization', 'billing', 'logs', params] as const,
  trend: (params: OrganizationUsageParams) =>
    ['organization', 'billing', 'trend', params] as const,
  models: (params: OrganizationUsageParams) =>
    ['organization', 'billing', 'models', params] as const,
  channels: (params: OrganizationUsageParams) =>
    ['organization', 'billing', 'channels', params] as const,
  organizations: (params: OrganizationListParams) =>
    ['admin', 'organizations', params] as const,
  adminDetail: (id: number) => ['admin', 'organizations', id] as const,
  adminMembers: (id: number, includeHistory: boolean) =>
    ['admin', 'organizations', id, 'members', includeHistory] as const,
  adminSummary: (id: number, params: OrganizationUsageParams) =>
    ['admin', 'organizations', id, 'billing', 'summary', params] as const,
  adminBillingMembers: (id: number, params: OrganizationUsageParams) =>
    ['admin', 'organizations', id, 'billing', 'members', params] as const,
  adminBillingModels: (id: number, params: OrganizationUsageParams) =>
    ['admin', 'organizations', id, 'billing', 'models', params] as const,
  adminBillingChannels: (id: number, params: OrganizationUsageParams) =>
    ['admin', 'organizations', id, 'billing', 'channels', params] as const,
  adminBillingTrend: (id: number, params: OrganizationUsageParams) =>
    ['admin', 'organizations', id, 'billing', 'trend', params] as const,
  adminLogs: (id: number, params: OrganizationUsageParams) =>
    ['admin', 'organizations', id, 'billing', 'logs', params] as const,
}

export async function getOrganizationSelf(): Promise<
  ApiResponse<OrganizationSelf | null>
> {
  const res = await api.get('/api/organization/self')
  return res.data
}

export async function updateCurrentOrganization(
  payload: OrganizationPayload
): Promise<ApiResponse<Organization>> {
  const res = await api.patch('/api/organization/current', payload)
  return res.data
}

export async function getCurrentOrganizationMembers(
  includeHistory = false
): Promise<ApiResponse<OrganizationMember[]>> {
  const query = buildQuery({
    include_history: includeHistory ? 'true' : undefined,
  })
  const res = await api.get(`/api/organization/current/members?${query}`)
  return res.data
}

export async function addCurrentOrganizationMember(
  payload: MemberPayload
): Promise<ApiResponse<OrganizationMember>> {
  const res = await api.post('/api/organization/current/members', payload)
  return res.data
}

export async function updateCurrentOrganizationMember(
  userId: number,
  payload: Pick<MemberPayload, 'role'>
): Promise<ApiResponse<OrganizationMember>> {
  const res = await api.patch(
    `/api/organization/current/members/${userId}`,
    payload
  )
  return res.data
}

export async function removeCurrentOrganizationMember(
  userId: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/organization/current/members/${userId}`)
  return res.data
}

export async function getOrganizationBillingSummary(
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationSummary>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/organization/current/billing/summary?${query}`
  )
  return res.data
}

export async function getOrganizationBillingLogs(
  params: OrganizationUsageParams
): Promise<ApiResponse<PaginatedResponse<OrganizationUsageRow>>> {
  const query = buildQuery(params)
  const res = await api.get(`/api/organization/current/billing/logs?${query}`)
  return res.data
}

export async function getOrganizationBillingTrend(
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationTrendRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(`/api/organization/current/billing/trend?${query}`)
  return res.data
}

export async function getOrganizationBillingModels(
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationDimensionRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(`/api/organization/current/billing/models?${query}`)
  return res.data
}

export async function getOrganizationBillingChannels(
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationDimensionRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/organization/current/billing/channels?${query}`
  )
  return res.data
}

export function buildOrganizationExportUrl(params: OrganizationUsageParams) {
  const query = buildQuery(params)
  return `/api/organization/current/billing/logs/export?${query}`
}

export async function getAdminOrganizations(
  params: OrganizationListParams
): Promise<ApiResponse<PaginatedResponse<Organization>>> {
  const query = buildQuery(params)
  const res = await api.get(`/api/admin/organizations?${query}`)
  return res.data
}

export async function createAdminOrganization(
  payload: Required<Pick<OrganizationPayload, 'name'>>
): Promise<ApiResponse<Organization>> {
  const res = await api.post('/api/admin/organizations', payload)
  return res.data
}

export async function getAdminOrganization(
  id: number
): Promise<ApiResponse<Organization>> {
  const res = await api.get(`/api/admin/organizations/${id}`)
  return res.data
}

export async function updateAdminOrganization(
  id: number,
  payload: OrganizationPayload
): Promise<ApiResponse<Organization>> {
  const res = await api.patch(`/api/admin/organizations/${id}`, payload)
  return res.data
}

export async function getAdminOrganizationMembers(
  id: number,
  includeHistory = false
): Promise<ApiResponse<OrganizationMember[]>> {
  const query = buildQuery({
    include_history: includeHistory ? 'true' : undefined,
  })
  const res = await api.get(`/api/admin/organizations/${id}/members?${query}`)
  return res.data
}

export async function addAdminOrganizationMember(
  id: number,
  payload: MemberPayload
): Promise<ApiResponse<OrganizationMember>> {
  const res = await api.post(`/api/admin/organizations/${id}/members`, payload)
  return res.data
}

export async function updateAdminOrganizationMember(
  id: number,
  userId: number,
  payload: Pick<MemberPayload, 'role'>
): Promise<ApiResponse<OrganizationMember>> {
  const res = await api.patch(
    `/api/admin/organizations/${id}/members/${userId}`,
    payload
  )
  return res.data
}

export async function removeAdminOrganizationMember(
  id: number,
  userId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/admin/organizations/${id}/members/${userId}`
  )
  return res.data
}

export async function getAdminOrganizationBillingSummary(
  id: number,
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationSummary>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/admin/organizations/${id}/billing/summary?${query}`
  )
  return res.data
}

export async function getAdminOrganizationBillingLogs(
  id: number,
  params: OrganizationUsageParams
): Promise<ApiResponse<PaginatedResponse<OrganizationUsageRow>>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/admin/organizations/${id}/billing/logs?${query}`
  )
  return res.data
}

export async function getAdminOrganizationBillingMembers(
  id: number,
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationDimensionRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/admin/organizations/${id}/billing/members?${query}`
  )
  return res.data
}

export async function getAdminOrganizationBillingModels(
  id: number,
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationDimensionRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/admin/organizations/${id}/billing/models?${query}`
  )
  return res.data
}

export async function getAdminOrganizationBillingChannels(
  id: number,
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationDimensionRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/admin/organizations/${id}/billing/channels?${query}`
  )
  return res.data
}

export async function getAdminOrganizationBillingTrend(
  id: number,
  params: OrganizationUsageParams
): Promise<ApiResponse<OrganizationTrendRow[]>> {
  const query = buildQuery(params)
  const res = await api.get(
    `/api/admin/organizations/${id}/billing/trend?${query}`
  )
  return res.data
}

export function buildAdminOrganizationExportUrl(
  id: number,
  params: OrganizationUsageParams
) {
  const query = buildQuery(params)
  return `/api/admin/organizations/${id}/billing/logs/export?${query}`
}
