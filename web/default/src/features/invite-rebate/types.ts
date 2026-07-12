export type InviteRebateSummary = {
  invitee_count: number
  topup_quota_sum: number
  rebate_quota_sum: number
  aff_quota: number
  aff_history_quota: number
  enabled: boolean
  ratio_bp: number
}

export type InviteRebateLog = {
  id: number
  inviter_id: number
  invitee_id: number
  topup_id: number
  trade_no: string
  topup_quota: number
  rebate_quota: number
  ratio_bp: number
  status: string
  created_at: number
}

export type InviteeRebateStat = {
  invitee_id: number
  username: string
  display_name: string
  topup_quota_sum: number
  rebate_quota_sum: number
  rebate_count: number
}

export type PageResult<T> = {
  page: number
  page_size: number
  total: number
  items: T
}

export type AdminInviteRebateSummary = {
  topup_quota_sum: number
  rebate_quota_sum: number
  row_count: number
  enabled: boolean
  ratio_bp: number
}

export type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}
