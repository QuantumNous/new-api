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
import type { UsageLog } from '@/features/usage-logs/data/schema'

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

export interface PageResponse<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export interface AffiliateScope {
  kind: 'none' | 'affiliate' | 'global'
  user_id?: number
  affiliate_level?: number
  max_depth?: number
}

export interface AffiliateStatus {
  enabled: boolean
  available: boolean
  unavailable_reason?: string
  message?: string
  scope?: AffiliateScope
}

export interface AffiliateSummary {
  team_user_count: number
  effective_new_user_count: number
  net_consumption_quota: number
  net_consumption_rmb: number
  estimated_commission_rmb: number
  head_fee_rmb: number
  pending_settlement_rmb: number
  kpi_tier_name: string
  rule_status: string
  daily_trends?: AffiliateSummaryTrendPoint[]
}

export interface AffiliateSummaryTrendPoint {
  period_start: number
  period_end: number
  effective_new_user_count: number
  net_consumption_quota: number
  net_consumption_rmb: number
  estimated_commission_rmb: number
  head_fee_rmb: number
  pending_settlement_rmb: number
}

export interface AffiliateTeamTreeNode {
  user_id: number
  username?: string
  affiliate_level?: number
  parent_user_id?: number
  direct_inviter_id?: number
  depth?: number
  source?: string
  effective_at?: number
  children?: AffiliateTeamTreeNode[]
}

export interface AffiliateTeamTree {
  items: AffiliateTeamTreeNode[]
  total: number
}

export interface AffiliateLogsParams {
  p?: number
  page_size?: number
  type?: number
  request_status?: string
  start_timestamp?: number
  end_timestamp?: number
  model_name?: string
  group?: string
  token_name?: string
  user_id?: number
  second_level_user_id?: number
}

export type AffiliateLog = UsageLog

export interface AffiliateLogFilters {
  model?: string
  group?: string
  tokenName?: string
  userId?: string
  secondLevelUserId?: string
  requestStatus?: string
  startTime?: string
  endTime?: string
}

export interface AffiliateProfile {
  id: number
  user_id: number
  username?: string
  parent_username?: string
  level: number
  status: AffiliateStatusValue
  parent_user_id: number
  invite_code: string
  aff_code?: string
  display_name?: string
  remark?: string
  activated_at?: number
  disabled_at?: number
  created_at?: number
  updated_at?: number
}

export type AffiliateStatusValue = 'active' | 'disabled' | string

export interface AffiliateProfilesParams {
  p?: number
  page_size?: number
  user_id?: number
  level?: number
  status?: string
}

export interface AffiliateProfileFilters {
  userId?: string
  level?: string
  status?: string
}

export interface AffiliateProfileFormValues {
  userId?: string
  level?: string
  parentUserId?: string
  inviteCode?: string
  reason?: string
}

export interface AffiliateProfilePayload {
  user_id: number
  level: number
  parent_user_id: number
  invite_code: string
  reason: string
}

export type AffiliateRuleSetStatus = 'draft' | 'published' | 'archived' | string

export interface AffiliateRuleSet {
  id: number
  version: string
  name: string
  status: AffiliateRuleSetStatus
  effective_start: number
  effective_end: number
  published_at: number
  config_snapshot?: string
  created_by_user_id?: number
  updated_by_user_id?: number
  created_at?: number
  updated_at?: number
}

export interface AffiliateRuleSetFilters {
  status?: string
}

export interface AffiliateRuleSetsParams {
  p?: number
  page_size?: number
  status?: string
}

export interface AffiliateRuleSetDraftFormValues {
  id?: string
  version?: string
  name?: string
  effectiveStart?: string
  effectiveEnd?: string
  reason?: string
  settlementCycle?: string
  freezeDays?: string
  minSettlementAmountCents?: string
  minSettlementAmountYuan?: string
  manualReviewEnabled?: boolean
  autoSettlementEnabled?: boolean
  reviewNote?: string
  commissionRulesJson?: string
  commissionTiersJson?: string
  kpiTiersJson?: string
  headFeeRulesJson?: string
  riskRulesJson?: string
}

export interface AffiliateRuleSetDraftPayload {
  id?: number
  version: string
  name: string
  effective_start?: number
  effective_end?: number
  reason?: string
  settlement_config?: {
    cycle?: string
    freeze_days?: number
    min_settlement_amount_cents?: number
    manual_review_enabled?: boolean
    auto_settlement_enabled?: boolean
    review_note?: string
  }
  commission_rules?: Record<string, unknown>[]
  commission_tiers?: Record<string, unknown>[]
  kpi_tiers?: Record<string, unknown>[]
  head_fee_rules?: Record<string, unknown>[]
  risk_rules?: Record<string, unknown>[]
}

export interface AffiliateRuleSetRollbackPayload {
  version: string
  name: string
  reason?: string
}

export type AffiliateCommissionStatus =
  | 'pending'
  | 'ready'
  | 'settled'
  | 'void'
  | string

export type AffiliateCommissionKind =
  | 'accrual'
  | 'clawback'
  | 'manual_adjustment'
  | string

export type AffiliateSettlementStatus =
  | 'draft'
  | 'frozen'
  | 'paid'
  | 'void'
  | string

export interface AffiliateCommissionEvent {
  id: number
  affiliate_user_id: number
  downstream_user_id: number
  source_log_id?: number
  source_top_up_id?: number
  kind: AffiliateCommissionKind
  status: AffiliateCommissionStatus
  rule_set_id: number
  kpi_snapshot_id?: number
  settlement_id?: number
  period_start: number
  period_end: number
  net_paid_consumption_cents?: number
  raw_quota?: number
  user_cumulative_net_paid_before_cents?: number
  user_cumulative_net_paid_after_cents?: number
  base_rate_bps?: number
  cap_rate_bps?: number
  kpi_coefficient_bps?: number
  final_rate_bps?: number
  commission_cents: number
  clawback_of_event_id?: number
  synthetic_marker?: string
  metadata?: string
  created_at?: number
  updated_at?: number
}

export interface AffiliateSettlement {
  id: number
  affiliate_user_id: number
  rule_set_id: number
  period_start: number
  period_end: number
  status: AffiliateSettlementStatus
  commission_cents: number
  head_fee_cents: number
  deduction_cents: number
  payable_cents: number
  frozen_until?: number
  paid_at?: number
  paid_by_user_id?: number
  payment_reference?: string
  snapshot?: string
  created_at?: number
  updated_at?: number
}

export interface AffiliateCommissionFilters {
  affiliateUserId?: string
  ruleSetId?: string
  downstreamUserId?: string
  settlementId?: string
  status?: string
  kind?: string
  periodStart?: string
  periodEnd?: string
}

export interface AffiliateSettlementFilters {
  affiliateUserId?: string
  ruleSetId?: string
  status?: string
  periodStart?: string
  periodEnd?: string
}

export interface AffiliateSettlementRunFormValues {
  ruleSetId?: string
  periodStart?: string
  periodEnd?: string
  freezeDays?: string
  now?: string
  quotaPerUnit?: string
  usdExchangeRate?: string
  reason?: string
}

export interface AffiliateCommissionRecomputeFormValues {
  ruleSetId?: string
  periodStart?: string
  periodEnd?: string
  quotaPerUnit?: string
  usdExchangeRate?: string
  reason?: string
}

export interface AffiliateCommissionAdjustmentFormValues {
  affiliateUserId?: string
  downstreamUserId?: string
  ruleSetId?: string
  periodStart?: string
  periodEnd?: string
  commissionCents?: string
  commissionYuan?: string
  reason?: string
}

export interface AffiliateSettlementRunPayload {
  rule_set_id: number
  period_start: number
  period_end: number
  freeze_days: number
  now: number
  quota_per_unit: number
  usd_exchange_rate: number
  reason: string
}

export interface AffiliateCommissionRecomputePayload {
  rule_set_id: number
  period_start: number
  period_end: number
  quota_per_unit: number
  usd_exchange_rate: number
  reason: string
}

export interface AffiliateCommissionAdjustmentPayload {
  affiliate_user_id: number
  downstream_user_id: number
  rule_set_id: number
  period_start: number
  period_end: number
  commission_cents: number
  reason: string
}

export interface AffiliateSettlementRunResult {
  kpi_snapshot_count: number
  commission_event_count: number
  head_fee_event_count: number
  settlement_count: number
  settlements?: AffiliateSettlement[]
}

export interface AffiliateCommissionRecomputeResult {
  voided_event_count: number
  created_event_count: number
  voided_event_ids?: number[]
  created_events?: AffiliateCommissionEvent[]
}
