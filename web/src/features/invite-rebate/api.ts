import { api } from '@/lib/api'
import { transferAffiliateQuota } from '@/features/wallet/api'

import type {
  AdminInviteRebateSummary,
  ApiResponse,
  InviteeRebateStat,
  InviteRebateLeaderboard,
  InviteRebateLog,
  InviteRebateSummary,
  PageResult,
} from './types'

export { transferAffiliateQuota }

export async function fetchInviteRebateSummary(): Promise<
  ApiResponse<InviteRebateSummary>
> {
  const res = await api.get('/api/user/invite_rebate/summary')
  return res.data
}

export async function fetchInviteRebateLogs(
  page = 1,
  pageSize = 20
): Promise<ApiResponse<PageResult<InviteRebateLog[]>>> {
  const res = await api.get('/api/user/invite_rebate/logs', {
    params: { p: page, page_size: pageSize },
  })
  return res.data
}

export async function fetchInviteRebateInvitees(
  page = 1,
  pageSize = 20
): Promise<ApiResponse<PageResult<InviteeRebateStat[]>>> {
  const res = await api.get('/api/user/invite_rebate/invitees', {
    params: { p: page, page_size: pageSize },
  })
  return res.data
}

export async function fetchInviteRebateLeaderboard(
  by: 'rebate' | 'invitees' = 'rebate',
  limit = 20
): Promise<ApiResponse<InviteRebateLeaderboard>> {
  const res = await api.get('/api/user/invite_rebate/leaderboard', {
    params: { by, limit },
    // Don't toast/global-fail the whole page if leaderboard is unavailable
    skipErrorHandler: true,
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

export async function fetchAdminInviteRebates(params: {
  p?: number
  page_size?: number
  inviter_id?: number
  invitee_id?: number
}): Promise<ApiResponse<PageResult<InviteRebateLog[]>>> {
  const res = await api.get('/api/invite_rebate/', { params })
  return res.data
}

export async function fetchAdminInviteRebateSummary(
  inviterId?: number
): Promise<ApiResponse<AdminInviteRebateSummary>> {
  const res = await api.get('/api/invite_rebate/summary', {
    params: inviterId ? { inviter_id: inviterId } : undefined,
  })
  return res.data
}

export async function triggerInviteRebateBackfill(
  limit = 100
): Promise<ApiResponse<unknown>> {
  const res = await api.post(
    `/api/system-task/invite-rebate-backfill?limit=${limit}`
  )
  return res.data
}

export async function fetchAffiliateCode(): Promise<ApiResponse<string>> {
  const res = await api.get('/api/user/aff')
  return res.data
}
