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
export type AffiliateCommissionSettlementType =
  | ''
  | 'wallet'
  | 'offline'
  | 'offline_cashback'

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
  base_quota: number
  reward_points: number
  settled_points: number
  wallet_redeemed_points: number
  offline_settled_points: number
  offline_cashback_points?: number
  pending_points: number
  currency: string
  payment_provider: string
  payment_method: string
  status: AffiliateCommissionStatus
  settlement_type?: AffiliateCommissionSettlementType
  settled_at?: number
  settled_by?: number
  settled_by_username?: string
  settle_remark?: string
  settled_payout_method?: string
  settled_payout_account?: string
  settled_payout_account_name?: string
  settled_cash_value_micros?: number
  settled_wallet_quota?: number
  settled_wallet_amount_micros?: number
  settled_price_per_wallet_unit_micros?: number
  settled_points_per_amount_unit?: number
  settled_offline_amount_per_point_micros?: number
  cash_value_micros?: number
  wallet_quota?: number
  wallet_amount_micros?: number
  price_per_wallet_unit_micros?: number
  created_at: number
  updated_at: number
}

export interface AffiliateCommissionSummary {
  pending_amount_micros: number
  settled_amount_micros: number
  total_amount_micros: number
  pending_points: number
  wallet_redeemed_points: number
  offline_settled_points: number
  offline_cashback_points?: number
  settled_points: number
  redeemed_points?: number
  total_points: number
  pending_count: number
  settled_count: number
  wallet_redeemed_count: number
  offline_settled_count: number
  offline_cashback_count?: number
  redeemed_count?: number
  total_count: number
  pending_cash_value_micros?: number
  pending_wallet_quota?: number
  pending_wallet_amount_micros?: number
  price_per_wallet_unit_micros?: number
  currency: string
}

export interface AffiliateCommissionListResponse {
  page: number
  page_size: number
  total: number
  items: AffiliateCommission[]
}

export interface AffiliateRewardPointSettlement {
  id: number
  commission_id: number
  promoter_id: number
  promoter_username?: string
  settlement_type: AffiliateCommissionSettlementType
  points: number
  wallet_quota: number
  wallet_amount_micros: number
  settled_by: number
  settled_by_username?: string
  settled_at: number
  remark?: string
  trade_no?: string
  buyer_id?: number
  buyer_username?: string
  level?: 1 | 2
  created_at: number
  updated_at: number
}

export interface AffiliateRewardPointSettlementListResponse {
  page: number
  page_size: number
  total: number
  items: AffiliateRewardPointSettlement[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
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

export interface AffiliateRewardPointSettlementFilters {
  settlement_type?: AffiliateCommissionSettlementType | ''
  promoter_id?: string
  start_time?: string
  end_time?: string
}

export interface AffiliateCommissionQuery extends AffiliateCommissionFilters {
  p?: number
  page_size?: number
}

export interface AffiliateRewardPointSettlementQuery
  extends AffiliateRewardPointSettlementFilters {
  p?: number
  page_size?: number
}

export interface RedeemAffiliateRewardPointsRequest {
  points?: number
}

export interface RedeemAffiliateRewardPointsResponse {
  redeemed_points: number
  redeemed_quota: number
  redeemed_wallet_amount: number
  redeemed_wallet_amount_micros: number
  cash_value_micros: number
  price_per_wallet_unit_micros: number
}

export interface QuoteAffiliateRewardPointsRequest {
  points: number
}

export interface QuoteAffiliateRewardPointsResponse {
  redeemable_points: number
  redeemed_quota: number
  redeemed_wallet_amount: number
  redeemed_wallet_amount_micros: number
  cash_value_micros: number
  price_per_wallet_unit_micros: number
}

export interface OfflineCashbackAffiliateRewardPointsRequest {
  promoter_id: number
  points: number
  remark?: string
}

export interface OfflineCashbackAffiliateRewardPointsResponse {
  promoter_id: number
  points: number
}
