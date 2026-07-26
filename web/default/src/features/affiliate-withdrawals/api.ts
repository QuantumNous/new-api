import { api } from '@/lib/api'

import type {
  AffiliateWithdrawal,
  AffiliateWithdrawalPage,
  ApiResponse,
  WithdrawalAction,
} from './types'

export async function getAdminAffiliateWithdrawals(params: {
  page: number
  pageSize: number
  status: string
}): Promise<ApiResponse<AffiliateWithdrawalPage>> {
  const response = await api.get('/api/affiliate/admin/withdrawals', {
    params: {
      p: params.page,
      page_size: params.pageSize,
      status: params.status || undefined,
    },
  })
  return response.data
}

export async function updateAffiliateWithdrawal(request: {
  id: number
  action: WithdrawalAction
  note?: string
  paymentReference?: string
}): Promise<ApiResponse<AffiliateWithdrawal>> {
  const response = await api.post(
    `/api/affiliate/admin/withdrawals/${request.id}/${request.action}`,
    {
      note: request.note,
      payment_reference: request.paymentReference,
    }
  )
  return response.data
}
