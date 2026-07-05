import { api } from '@/lib/api'
import type {
  CommissionInfo,
  CommissionLogsResponse,
  CommissionStatsResponse,
  CommissionLogsParams,
  CommissionPeriod,
  ConsumptionLogsParams,
  ConsumptionLogsResponse,
  CommissionTransferRequest,
} from './types'

export async function getCommissionInfo(): Promise<{
  success?: boolean
  message?: string
  data?: CommissionInfo
}> {
  const res = await api.get('/api/user/commission/info')
  return res.data
}

export async function getCommissionLogs(
  params?: CommissionLogsParams
): Promise<{ success?: boolean; message?: string; data?: CommissionLogsResponse }> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.status) searchParams.set('status', params.status)
  const qs = searchParams.toString()
  const res = await api.get(`/api/user/commission/logs${qs ? `?${qs}` : ''}`)
  return res.data
}

export async function getCommissionStats(
  period?: CommissionPeriod
): Promise<{ success?: boolean; message?: string; data?: CommissionStatsResponse }> {
  const qs = period ? `?period=${period}` : ''
  const res = await api.get(`/api/user/commission/stats${qs}`)
  return res.data
}

export async function getConsumptionLogs(
  params?: ConsumptionLogsParams
): Promise<{
  success?: boolean
  message?: string
  data?: ConsumptionLogsResponse
}> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  const qs = searchParams.toString()
  const res = await api.get(
    `/api/user/commission/consumption${qs ? `?${qs}` : ''}`
  )
  return res.data
}

export async function transferCommission(
  request: CommissionTransferRequest
): Promise<{ success?: boolean; message?: string }> {
  const res = await api.post('/api/user/commission/transfer', request)
  return res.data
}
