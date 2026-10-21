/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { api } from '@/lib/api'

import type {
  AdminCommissionRecord,
  CommissionOverview,
  CommissionRule,
} from './types'

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T }

export async function getRules(): Promise<CommissionRule[]> {
  const res = await api.get<ApiEnvelope<CommissionRule[]>>(
    '/api/commission-admin/rules'
  )
  return res.data.data ?? []
}

export async function updateRule(
  id: number,
  patch: Partial<CommissionRule>
): Promise<void> {
  const res = await api.put<ApiEnvelope<null>>(
    `/api/commission-admin/rules/${id}`,
    patch
  )
  if (!res.data.success) throw new Error(res.data.message || 'update failed')
}

export async function listRecords(params: Record<string, unknown>): Promise<{
  records: AdminCommissionRecord[]
  total: number
}> {
  const res = await api.get<
    ApiEnvelope<{ records: AdminCommissionRecord[]; total: number }>
  >('/api/commission-admin/records', { params })
  return res.data.data ?? { records: [], total: 0 }
}

export async function voidRecord(id: number, reason: string): Promise<void> {
  const res = await api.post<ApiEnvelope<null>>(
    `/api/commission-admin/records/${id}/void`,
    { reason }
  )
  if (!res.data.success) throw new Error(res.data.message || 'void failed')
}

export async function settleNow(): Promise<{ settled: number }> {
  const res = await api.post<ApiEnvelope<{ settled: number }>>(
    '/api/commission-admin/settle-now'
  )
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'settle failed')
  }
  return res.data.data
}

export async function getOverview(): Promise<CommissionOverview> {
  const res = await api.get<ApiEnvelope<CommissionOverview>>(
    '/api/commission-admin/stats'
  )
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'overview failed')
  }
  return res.data.data
}
