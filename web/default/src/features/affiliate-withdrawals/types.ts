export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'paid'
  | 'rejected'
  | 'cancelled'

export interface AffiliateWithdrawal {
  id: number
  user_id: number
  username: string
  currency: string
  amount_micros: number
  status: WithdrawalStatus
  payout_method: string
  payout_account: string
  requested_at: number
  reviewed_at: number
  reviewed_by: number
  review_note: string
  paid_at: number
  payment_reference: string
}

export interface AffiliateWithdrawalPage {
  items: AffiliateWithdrawal[]
  total: number
  page: number
  page_size: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

export type WithdrawalAction = 'approve' | 'reject' | 'paid'
