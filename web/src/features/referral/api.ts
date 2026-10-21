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
  CommissionDownline,
  CommissionQuotaPreview,
  CommissionRecord,
  CommissionRedemption,
  CommissionStats,
} from './types'

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T }

export async function getCommissionStats(): Promise<CommissionStats> {
  const res = await api.get<ApiEnvelope<CommissionStats>>(
    '/api/user/commission/stats'
  )
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'load failed')
  }
  return res.data.data
}

export async function getCommissionRecords(params: {
  status?: string
  page?: number
  size?: number
}): Promise<{ records: CommissionRecord[]; total: number }> {
  const res = await api.get<
    ApiEnvelope<{ records: CommissionRecord[]; total: number }>
  >('/api/user/commission/records', { params })
  return res.data.data ?? { records: [], total: 0 }
}

export async function getCommissionRedemptions(params: {
  page?: number
  size?: number
}): Promise<CommissionRedemption[]> {
  const res = await api.get<ApiEnvelope<{ records: CommissionRedemption[] }>>(
    '/api/user/commission/redemptions',
    { params }
  )
  return res.data.data?.records ?? []
}

export async function getCommissionDownlines(params: {
  level: 1 | 2
  page?: number
  size?: number
}): Promise<{ rows: CommissionDownline[]; total: number }> {
  const res = await api.get<
    ApiEnvelope<{ rows: CommissionDownline[]; total: number }>
  >('/api/user/commission/downlines', { params })
  return res.data.data ?? { rows: [], total: 0 }
}

export async function previewQuotaCredit(
  cents: number
): Promise<CommissionQuotaPreview> {
  const res = await api.get<ApiEnvelope<CommissionQuotaPreview>>(
    '/api/user/commission/quota-preview',
    { params: { cents } }
  )
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'preview failed')
  }
  return res.data.data
}

export async function redeemCommission(
  cents: number
): Promise<{ quota_credited: number }> {
  const res = await api.post<ApiEnvelope<{ quota_credited: number }>>(
    '/api/user/commission/redeem',
    { cents }
  )
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'redeem failed')
  }
  return res.data.data
}
