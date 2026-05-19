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
import type { AxiosRequestConfig } from 'axios'
import { api } from '@/lib/api'
import type {
  ApiResponse,
  AffiliateCommissionListResponse,
  AffiliateCommissionQuery,
  AffiliatePayoutProfile,
  AffiliatePayoutProfileRequest,
  AffiliateCommissionSummary,
} from './types'

function buildQueryString(query: AffiliateCommissionQuery = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

function getCsvFilename(contentDisposition?: string) {
  const fallback = 'affiliate-commissions.csv'
  if (!contentDisposition) return fallback

  const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedFilename?.[1]) {
    try {
      return decodeURIComponent(encodedFilename[1].replace(/["']/g, ''))
    } catch {
      return encodedFilename[1].replace(/["']/g, '')
    }
  }

  const filename = contentDisposition.match(/filename="?([^";]+)"?/i)
  return filename?.[1]?.trim() || fallback
}

export function buildAdminAffiliateCommissionExportUrl(
  query: AffiliateCommissionQuery = {}
) {
  const qs = buildQueryString(query)
  return `/api/affiliate/admin/commissions/export${qs ? `?${qs}` : ''}`
}

export async function exportAdminAffiliateCommissionsCsv(
  query: AffiliateCommissionQuery = {}
): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get(buildAdminAffiliateCommissionExportUrl(query), {
    responseType: 'blob',
    disableDuplicate: true,
  } as AxiosRequestConfig & { disableDuplicate: boolean })
  const contentDisposition = res.headers['content-disposition']

  return {
    blob: res.data as Blob,
    filename: getCsvFilename(
      typeof contentDisposition === 'string' ? contentDisposition : undefined
    ),
  }
}

export async function getSelfAffiliateSummary(): Promise<
  ApiResponse<AffiliateCommissionSummary>
> {
  const res = await api.get('/api/affiliate/self/summary')
  return res.data
}

export async function getSelfAffiliateCommissions(
  query: AffiliateCommissionQuery = {}
): Promise<ApiResponse<AffiliateCommissionListResponse>> {
  const qs = buildQueryString(query)
  const res = await api.get(
    `/api/affiliate/self/commissions${qs ? `?${qs}` : ''}`
  )
  return res.data
}

export async function getSelfAffiliatePayoutProfile(): Promise<
  ApiResponse<AffiliatePayoutProfile>
> {
  const res = await api.get('/api/affiliate/self/payout-profile')
  return res.data
}

export async function updateSelfAffiliatePayoutProfile(
  payload: AffiliatePayoutProfileRequest
): Promise<ApiResponse<AffiliatePayoutProfile>> {
  const res = await api.put('/api/affiliate/self/payout-profile', payload)
  return res.data
}

export async function getAdminAffiliateSummary(
  query: AffiliateCommissionQuery = {}
): Promise<ApiResponse<AffiliateCommissionSummary>> {
  const qs = buildQueryString(query)
  const res = await api.get(`/api/affiliate/admin/summary${qs ? `?${qs}` : ''}`)
  return res.data
}

export async function getAdminAffiliateCommissions(
  query: AffiliateCommissionQuery = {}
): Promise<ApiResponse<AffiliateCommissionListResponse>> {
  const qs = buildQueryString(query)
  const res = await api.get(
    `/api/affiliate/admin/commissions${qs ? `?${qs}` : ''}`
  )
  return res.data
}

export async function settleAffiliateCommissions(
  ids: number[],
  remark: string
): Promise<ApiResponse> {
  const res = await api.post('/api/affiliate/admin/commissions/settle', {
    ids,
    remark,
  })
  return res.data
}
