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
export type AffiliateCommissionStatus = 'pending' | 'settled'

export interface AffiliateCommission {
  id: number
  trade_no: string
  top_up_id: number
  buyer_id: number
  buyer_username?: string
  buyer_direct_inviter_id?: number | null
  buyer_direct_inviter_username?: string | null
  buyer_direct_inviter_distribution_enabled?: boolean | null
  buyer_second_inviter_id?: number | null
  buyer_second_inviter_username?: string | null
  buyer_second_inviter_distribution_enabled?: boolean | null
  promoter_id: number
  promoter_username?: string
  promoter_payout_method?: string
  promoter_payout_account?: string
  promoter_payout_account_name?: string
  level: 1 | 2
  base_amount_micros: number
  commission_rate_bps: number
  commission_amount_micros: number
  currency: string
  payment_provider: string
  payment_method: string
  status: AffiliateCommissionStatus
  settled_at?: number
  settled_by?: number
  settled_by_username?: string
  settle_remark?: string
  settled_payout_method?: string
  settled_payout_account?: string
  settled_payout_account_name?: string
  created_at: number
  updated_at: number
}

export interface AffiliateCommissionSummary {
  pending_amount_micros: number
  settled_amount_micros: number
  total_amount_micros: number
  pending_count: number
  settled_count: number
  total_count: number
  currency: string
}

export interface AffiliateCommissionListResponse {
  page: number
  page_size: number
  total: number
  items: AffiliateCommission[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface AffiliatePayoutProfile {
  id?: number
  user_id: number
  method: 'paypal'
  account: string
  account_name?: string
  created_at?: number
  updated_at?: number
}

export interface AffiliatePayoutProfileRequest {
  method: 'paypal'
  account: string
  account_name?: string
}

export interface AffiliateCommissionFilters {
  status?: AffiliateCommissionStatus | ''
  level?: '' | '1' | '2'
  promoter_id?: string
  buyer_id?: string
  trade_no?: string
  start_time?: string
  end_time?: string
}

export interface AffiliateCommissionQuery extends AffiliateCommissionFilters {
  p?: number
  page_size?: number
}
