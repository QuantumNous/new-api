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
  user_id?: number
  second_level_user_id?: number
}

export type AffiliateLog = UsageLog

export interface AffiliateLogFilters {
  model?: string
  group?: string
  userId?: string
  secondLevelUserId?: string
  requestStatus?: string
  startTime?: string
  endTime?: string
}

export interface AffiliateProfile {
  id: number
  user_id: number
  level: number
  status: AffiliateStatusValue
  parent_user_id: number
  invite_code: string
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
  manualReviewEnabled?: boolean
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
  }
  commission_rules?: Record<string, unknown>[]
  commission_tiers?: Record<string, unknown>[]
  kpi_tiers?: Record<string, unknown>[]
  head_fee_rules?: Record<string, unknown>[]
  risk_rules?: Record<string, unknown>[]
}
