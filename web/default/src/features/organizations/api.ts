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

import { t } from 'i18next'
import { toast } from 'sonner'

import { api } from '@/lib/api'

import type {
  ApiResponse,
  MemberPayload,
  Organization,
  OrganizationBillingFilterOptions,
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
  filterOptions: ['organization', 'billing', 'filter-options'] as const,
  adminFilterOptions: (id: number) =>
    ['admin', 'organizations', id, 'billing', 'filter-options'] as const,
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

export async function getOrganizationBillingFilterOptions(): Promise<
  ApiResponse<OrganizationBillingFilterOptions>
> {
  const [members, models, channels] = await Promise.all([
    getCurrentOrganizationMembers(true),
    getOrganizationBillingModels({}),
    getOrganizationBillingChannels({}),
  ])
  const failed = [members, models, channels].find(
    (response) => !response.success
  )
  if (failed) return { success: false, message: failed.message }
  return {
    success: true,
    data: {
      members: members.data ?? [],
      models: models.data ?? [],
      channels: channels.data ?? [],
    },
  }
}

export function buildOrganizationExportUrl(params: OrganizationUsageParams) {
  const query = buildQuery(params)
  return `/api/organization/current/billing/export?${query}`
}

export function buildOrganizationLogsExportUrl(
  params: OrganizationUsageParams
) {
  const query = buildQuery(params)
  return `/api/organization/current/billing/logs/export?${query}`
}

// Exports must go through the shared axios instance so the request carries the
// New-Api-User header required by authHelper. A plain window.location.href
// navigation cannot attach that header and is rejected as unauthorized.
export async function downloadOrganizationExport(url: string): Promise<void> {
  try {
    const res = await api.get(url, { responseType: 'blob' })
    const blob = res.data as Blob
    // The backend signals business errors as JSON; responseType:'blob' wraps
    // that payload in a Blob, so decode it here instead of saving it as CSV.
    if (blob.type?.includes('application/json')) {
      toast.error(readExportErrorMessage(await blob.text()))
      return
    }
    triggerBlobDownload(
      blob,
      readExportFilename(res.headers['content-disposition'], url)
    )
  } catch {
    // Network and HTTP errors are surfaced by the global response interceptor.
  }
}

function readExportErrorMessage(text: string): string {
  try {
    const payload = JSON.parse(text) as { message?: string }
    return payload.message || t('Request failed')
  } catch {
    return t('Request failed')
  }
}

function readExportFilename(
  disposition: string | undefined,
  url: string
): string {
  const fallback = url.includes('/billing/logs/export')
    ? 'organization-billing-logs.csv'
    : 'organization-billing.csv'
  if (!disposition) return fallback
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
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

export async function getAdminOrganizationBillingFilterOptions(
  id: number
): Promise<ApiResponse<OrganizationBillingFilterOptions>> {
  const [members, models, channels] = await Promise.all([
    getAdminOrganizationMembers(id, true),
    getAdminOrganizationBillingModels(id, {}),
    getAdminOrganizationBillingChannels(id, {}),
  ])
  const failed = [members, models, channels].find(
    (response) => !response.success
  )
  if (failed) return { success: false, message: failed.message }
  return {
    success: true,
    data: {
      members: members.data ?? [],
      models: models.data ?? [],
      channels: channels.data ?? [],
    },
  }
}

export function buildAdminOrganizationExportUrl(
  id: number,
  params: OrganizationUsageParams
) {
  const query = buildQuery(params)
  return `/api/admin/organizations/${id}/billing/export?${query}`
}

export function buildAdminOrganizationLogsExportUrl(
  id: number,
  params: OrganizationUsageParams
) {
  const query = buildQuery(params)
  return `/api/admin/organizations/${id}/billing/logs/export?${query}`
}
