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
