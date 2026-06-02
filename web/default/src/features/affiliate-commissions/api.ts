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
  AffiliateRewardPointSettlementListResponse,
  AffiliateRewardPointSettlementQuery,
  AffiliateCommissionSummary,
  AffiliateCdkCode,
  AffiliateCdkCodeListResponse,
  AffiliateCdkCodeQuery,
  AffiliateCdkInfo,
  AffiliateCdkOrderListResponse,
  AffiliateCdkOrderQuery,
  AffiliateCdkPayRequest,
  AffiliateCdkPayResponse,
  AffiliateCdkQuote,
  AffiliateCdkQuoteRequest,
  OfflineCashbackAffiliateRewardPointsRequest,
  OfflineCashbackAffiliateRewardPointsResponse,
  QuoteAffiliateRewardPointsRequest,
  QuoteAffiliateRewardPointsResponse,
  RedeemAffiliateRewardPointsRequest,
  RedeemAffiliateRewardPointsResponse,
} from './types'

function buildQueryString<T extends object>(query: T = {} as T) {
  const params = new URLSearchParams()
  Object.entries(query as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

function buildSettlementQueryString(
  query: AffiliateRewardPointSettlementQuery = {}
) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

function getCsvFilename(contentDisposition?: string) {
  const fallback = 'affiliate-reward-points.csv'
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

export async function getSelfAffiliateRewardPointSettlements(
  query: AffiliateRewardPointSettlementQuery = {}
): Promise<ApiResponse<AffiliateRewardPointSettlementListResponse>> {
  const qs = buildSettlementQueryString(query)
  const res = await api.get(
    `/api/affiliate/self/redemptions${qs ? `?${qs}` : ''}`
  )
  return res.data
}

export async function redeemSelfAffiliateRewardPoints(
  payload: RedeemAffiliateRewardPointsRequest = {}
): Promise<ApiResponse<RedeemAffiliateRewardPointsResponse>> {
  const res = await api.post('/api/affiliate/self/rewards/redeem', payload)
  return res.data
}

export async function quoteSelfAffiliateRewardPoints(
  payload: QuoteAffiliateRewardPointsRequest
): Promise<ApiResponse<QuoteAffiliateRewardPointsResponse>> {
  const res = await api.post('/api/affiliate/self/rewards/quote', payload)
  return res.data
}

export async function getSelfAffiliateCdkInfo(): Promise<
  ApiResponse<AffiliateCdkInfo>
> {
  const res = await api.get('/api/affiliate/self/cdk/info')
  return res.data
}

export async function quoteSelfAffiliateCdk(
  payload: AffiliateCdkQuoteRequest
): Promise<ApiResponse<AffiliateCdkQuote>> {
  const res = await api.post('/api/affiliate/self/cdk/quote', payload)
  return res.data
}

export async function requestSelfAffiliateCdkEpay(
  payload: AffiliateCdkPayRequest
): Promise<AffiliateCdkPayResponse> {
  const res = await api.post('/api/affiliate/self/cdk/epay/pay', payload, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

export async function getSelfAffiliateCdkOrders(
  query: AffiliateCdkOrderQuery = {}
): Promise<ApiResponse<AffiliateCdkOrderListResponse>> {
  const qs = buildQueryString(query)
  const res = await api.get(
    `/api/affiliate/self/cdk/orders${qs ? `?${qs}` : ''}`
  )
  return res.data
}

export async function getSelfAffiliateCdkOrderCodes(
  orderId: number
): Promise<ApiResponse<AffiliateCdkCode[]>> {
  const res = await api.get(`/api/affiliate/self/cdk/orders/${orderId}/codes`)
  return res.data
}

export async function getSelfAffiliateCdkCodes(
  query: AffiliateCdkCodeQuery = {}
): Promise<ApiResponse<AffiliateCdkCodeListResponse>> {
  const qs = buildQueryString(query)
  const res = await api.get(
    `/api/affiliate/self/cdk/codes${qs ? `?${qs}` : ''}`,
    {
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
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

export async function getAdminAffiliateRewardPointSettlements(
  query: AffiliateRewardPointSettlementQuery = {}
): Promise<ApiResponse<AffiliateRewardPointSettlementListResponse>> {
  const qs = buildSettlementQueryString(query)
  const res = await api.get(
    `/api/affiliate/admin/redemptions${qs ? `?${qs}` : ''}`
  )
  return res.data
}

export async function offlineCashbackAffiliateRewardPoints(
  payload: OfflineCashbackAffiliateRewardPointsRequest
): Promise<ApiResponse<OfflineCashbackAffiliateRewardPointsResponse>> {
  const res = await api.post(
    '/api/affiliate/admin/rewards/offline-cashback',
    payload
  )
  return res.data
}
