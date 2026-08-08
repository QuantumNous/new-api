export interface CommissionWallet {
  balance: number
  total_earned: number
  total_withdrawn: number
  monthly_earned: number
}

export interface CommissionTier {
  min_users: number
  rate: number
}

export interface TierInfo {
  current_rate: number
  active_count: number
  next_min_users: number
  next_rate: number
  need_for_next: number
  tiers: CommissionTier[]
  default_rate: number
}

export interface CommissionRecord {
  id: number
  user_id: number
  from_user_id: number
  top_up_id: number
  amount: number
  rate: number
  status: string
  remark: string
  created_at: number
  username?: string
}

export interface WithdrawalRequest {
  id: number
  user_id: number
  username?: string
  amount: number
  status: string
  pay_info: string
  note: string
  admin_id: number
  admin_name?: string
  created_at: number
  updated_at: number
}

export interface DownlineUser {
  id: number
  username: string
  total_topup: number
  created_at: number
  last_topup_at: number
}

export interface PromoterItem {
  id: number
  username: string
  active_aff_count: number
  commission_rate: number
  wallet_balance: number
  total_earned: number
  total_withdrawn: number
}

export interface CommissionConfig {
  default_rate: number
  tiers: CommissionTier[]
  min_withdraw_amount: number
}

export interface CommissionDashboardStats {
  total_commission_paid: number
  active_promoters: number
  pending_withdrawals: number
  pending_withdrawal_amount: number
  tier_distribution: { rate: string; count: number }[]
  top_promoters: { id: number; username: string; total_earned: number }[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PaginatedData<T> {
  records?: T[]
  withdrawals?: T[]
  downlines?: T[]
  promoters?: T[]
  total: number
  page: number
  size: number
}
