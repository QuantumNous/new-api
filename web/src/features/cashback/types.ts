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
export type CashbackTier = { threshold_cents: number; reward_cents: number }
export type CashbackStrategy = 'rate' | 'per_hundred' | 'tiered'
export type CashbackPublicOffer = {
  strategy: CashbackStrategy
  rate_bps?: number
  fixed_per_hundred?: number
  tiers?: CashbackTier[]
  /** Payer offers only; absent means every eligible order is rewarded. */
  payer_scope?: 'first_top_up' | ''
}
export type CashbackPublicOffers = {
  active: boolean
  currency: 'CNY'
  inviter?: CashbackPublicOffer
  invitee?: CashbackPublicOffer
}
export type CashbackDirection = 'inviter' | 'invitee'
export type CashbackReviewStatus = 'pending' | 'approved' | 'rejected'
export type CashbackSettlementStatus =
  | 'frozen'
  | 'issued'
  | 'canceled'
  | 'reclaimed'
  | 'debt'
export type CashbackRiskLevel = 'low' | 'medium' | 'high' | 'severe'
export type CashbackIncidentKind = 'refund' | 'chargeback' | 'dispute'

export type CashbackReward = {
  id: number
  top_up_id: number
  trade_no: string
  direction: CashbackDirection
  invitee_id: number
  inviter_id: number
  beneficiary_id: number
  base_quota: number
  rate_bps: number
  strategy?: CashbackStrategy | ''
  fixed_per_hundred?: number
  calculated_quota: number
  reward_quota: number
  cap_reason: string
  settlement_days: number
  config_version: number
  paid_at: number
  available_at: number
  review_status: CashbackReviewStatus
  reviewed_by: number
  review_source: 'automatic' | 'manual' | ''
  reviewed_at: number
  review_reason: string
  settlement_status: CashbackSettlementStatus
  issued_at: number
  risk_level: CashbackRiskLevel
  risk_flags: string[]
  blocking_reason: string
  recovered_quota: number
  outstanding_debt_quota: number
  debt_resolved_at: number
  debt_resolved_by: number
  debt_resolution_reason: string
  last_settlement_error: string
  next_settlement_attempt_at: number
  created_at: number
  updated_at: number
}

export type CashbackOrderContext = {
  id: number
  top_up_id: number
  campaign_id: number
  trade_no: string
  user_id: number
  payment_provider: string
  base_quota: number
  face_amount?: number
  quota_per_face_unit?: string
  credited_quota: number
  request_ip: string
  request_user_agent_hash: string
  device_fingerprint_hash: string
  device_hash_short: string
  device_signal_status: string
  eligible_after_first_enable: boolean
  completion_source: string
  completion_provider: string
  incident_kind: CashbackIncidentKind | ''
  incident_reason: string
  incident_evidence_ref: string
  incident_reported_by: number
  incident_reported_at: number
  cumulative_refund_rate_bps: number
  principal_reversal_target_quota: number
  principal_recovered_quota: number
  principal_outstanding_debt_quota: number
  principal_debt_resolved_at: number
  principal_debt_resolved_by: number
  principal_debt_resolution_reason: string
  created_at: number
  updated_at: number
}

export type CashbackRewardDetail = {
  reward: CashbackReward
  order: CashbackOrderContext
  risk_snapshot: Record<string, unknown>
  config_snapshot: Record<string, unknown>
  invitee_username: string
  inviter_username: string
  beneficiary_username: string
}

export type CashbackRewardFilters = {
  page: number
  pageSize: number
  tradeNo: string
  userId: string
  campaignId: string
  direction: CashbackDirection | ''
  reviewStatus: CashbackReviewStatus | ''
  settlementStatus: CashbackSettlementStatus | ''
  riskLevel: CashbackRiskLevel | ''
}

export type CashbackRewardPage = {
  page: number
  page_size: number
  total: number
  items: CashbackReward[]
}

export type CashbackInviterCluster = {
  inviter_id: number
  distinct_invitees: number
  reward_count: number
  reward_quota: number
}

export type CashbackDeviceCluster = {
  device_hash_short: string
  account_count: number
}

export type CashbackSummary = {
  pending_review_quota: number
  awaiting_maturity_quota: number
  issued_quota: number
  recovered_quota: number
  outstanding_reward_debt: number
  outstanding_principal_debt: number
  rejected_or_canceled_count: number
  incident_count: number
  settlement_failure_count: number
  reconciliation_issues: number
  risk_counts: Partial<Record<CashbackRiskLevel, number>>
  inviter_clusters: CashbackInviterCluster[]
  device_clusters: CashbackDeviceCluster[]
}

export type CashbackRecordedSpendReport = {
  user_id: number
  start_at: number
  end_at: number
  calculated_at: number
  source: 'optional_log_db_consume'
  log_status: 'available' | 'unavailable'
  refund_status: 'reference' | 'manual_reconciliation'
  manual_reason?: string
  settlement_assumed: boolean
  wallet_quota?: number
  net_spent_quota?: number
  total_reference_cny_cents?: number
  credits: {
    event_id: number
    kind: 'opening' | 'purchase' | 'gift' | 'nonrefundable' | 'exception'
    source_type: string
    source_id: number
    quota: number
    remaining_quota: number
    trade_no?: string
    payment_provider?: string
    signed_amount_available: boolean // Amount is signed; Epay does NOT attest currency.
    reference_cny_cents?: number
  }[]
  top_ups: {
    id: number
    trade_no: string
    complete_time: number
    payment_provider: string
    purchased_quota?: number
    remaining_purchase_quota?: number
    remaining_gift_quota?: number
    reference_cny_cents?: number
  }[]
  intervals: {
    start_at: number
    end_at: number
    // Sum of all observed consume-log quota, including subscription-funded usage;
    // not wallet spend or FIFO evidence.
    recorded_all_consume_log_quota: number
    recorded_consume_count: number
  }[]
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}
