import { api } from '@/lib/api'
import type {
  ApiResponse,
  CommissionWallet,
  TierInfo,
  CommissionRecord,
  WithdrawalRequest,
  DownlineUser,
  CommissionConfig,
  PromoterItem,
  CommissionDashboardStats,
  PaginatedData,
} from './types'

// ============================================================================
// User-facing Commission APIs
// ============================================================================

export async function getCommissionWallet(): Promise<ApiResponse<CommissionWallet>> {
  const res = await api.get('/api/commission/wallet')
  return res.data
}

export async function getCommissionTierInfo(): Promise<ApiResponse<TierInfo>> {
  const res = await api.get('/api/commission/tier-info')
  return res.data
}

export async function getCommissionRecords(
  page = 1,
  pageSize = 20,
  status = ''
): Promise<ApiResponse<PaginatedData<CommissionRecord>>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (status) params.set('status', status)
  const res = await api.get(`/api/commission/records?${params.toString()}`)
  return res.data
}

export async function transferCommissionToBalance(
  amount: number
): Promise<ApiResponse> {
  const res = await api.post('/api/commission/transfer', { amount })
  return res.data
}

export async function createWithdrawalRequest(
  amount: number,
  payInfo: string
): Promise<ApiResponse> {
  const res = await api.post('/api/commission/withdraw', {
    amount,
    pay_info: payInfo,
  })
  return res.data
}

export async function getUserWithdrawals(
  page = 1,
  pageSize = 20
): Promise<ApiResponse<PaginatedData<WithdrawalRequest>>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const res = await api.get(`/api/commission/withdrawals?${params.toString()}`)
  return res.data
}

export async function getDownlineUsers(
  page = 1,
  pageSize = 20
): Promise<ApiResponse<PaginatedData<DownlineUser>>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const res = await api.get(`/api/commission/downline?${params.toString()}`)
  return res.data
}

// ============================================================================
// Admin Commission APIs
// ============================================================================

export async function getCommissionConfigAdmin(): Promise<ApiResponse<CommissionConfig>> {
  const res = await api.get('/api/commission/admin/config')
  return res.data
}

export async function updateCommissionConfig(
  config: CommissionConfig
): Promise<ApiResponse> {
  const res = await api.put('/api/commission/admin/config', config)
  return res.data
}

export async function getAllCommissionRecords(
  page = 1,
  pageSize = 20,
  userId = 0,
  status = ''
): Promise<ApiResponse<PaginatedData<CommissionRecord>>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (userId) params.set('user_id', String(userId))
  if (status) params.set('status', status)
  const res = await api.get(`/api/commission/admin/records?${params.toString()}`)
  return res.data
}

export async function adjustCommission(
  userId: number,
  amount: number,
  remark = ''
): Promise<ApiResponse> {
  const res = await api.post('/api/commission/admin/adjust', {
    user_id: userId,
    amount,
    remark,
  })
  return res.data
}

export async function getAllWithdrawals(
  page = 1,
  pageSize = 20,
  status = ''
): Promise<ApiResponse<PaginatedData<WithdrawalRequest>>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (status) params.set('status', status)
  const res = await api.get(
    `/api/commission/admin/withdrawals?${params.toString()}`
  )
  return res.data
}

export async function reviewWithdrawal(
  id: number,
  action: 'approve' | 'reject',
  note = ''
): Promise<ApiResponse> {
  const res = await api.post('/api/commission/admin/withdrawals/review', {
    id,
    action,
    note,
  })
  return res.data
}

export async function batchApproveWithdrawals(
  ids: number[]
): Promise<ApiResponse> {
  const res = await api.post(
    '/api/commission/admin/withdrawals/batch-approve',
    { ids }
  )
  return res.data
}

export async function getPromoterList(
  page = 1,
  pageSize = 20,
  keyword = ''
): Promise<ApiResponse<PaginatedData<PromoterItem>>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (keyword) params.set('keyword', keyword)
  const res = await api.get(
    `/api/commission/admin/promoters?${params.toString()}`
  )
  return res.data
}

export async function getCommissionDashboard(): Promise<
  ApiResponse<CommissionDashboardStats>
> {
  const res = await api.get('/api/commission/admin/dashboard')
  return res.data
}
