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
import type { TimeGranularity } from '@/lib/time'

// ============================================================================
// Quota & Usage Data Types
// ============================================================================

export interface QuotaDataItem {
  id?: number
  user_id?: number
  username?: string
  model_name?: string
  created_at: number
  token_used?: number
  count?: number
  quota?: number
}

export interface TokenQuotaDataItem {
  id?: number
  user_id?: number
  username?: string
  token_id?: number
  token_name?: string
  model_name?: string
  created_at: number
  token_used?: number
  count?: number
  quota?: number
}

export interface CodexLimitWindow {
  used_percent: number
  reset_at?: number
  reset_after_seconds?: number
  limit_window_seconds?: number
}

export interface CodexAdditionalLimit {
  name: string
  metered_feature?: string
  five_hour_window?: CodexLimitWindow
  weekly_window?: CodexLimitWindow
}

export interface CodexLimitReportRow {
  channel_id: number
  channel_name: string
  channel_status: number
  range_token_used: number
  range_quota: number
  success: boolean
  message?: string
  upstream_status?: number
  plan_type?: string
  email?: string
  account_id?: string
  user_id?: string
  allowed: boolean
  limit_reached: boolean
  base_five_hour_window?: CodexLimitWindow
  base_weekly_window?: CodexLimitWindow
  additional_limits?: CodexAdditionalLimit[]
}

export interface CodexLimitReport {
  generated_at: number
  start_timestamp: number
  end_timestamp: number
  total_channels: number
  success_count: number
  failure_count: number
  total_token_used: number
  total_quota: number
  rows: CodexLimitReportRow[]
}

export interface ProcessedTokenChartData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec_token_rank: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec_token_trend: Record<string, any>
}

// ============================================================================
// Uptime Monitoring Types
// ============================================================================

export interface UptimeMonitor {
  name: string
  uptime: number
  status: number
  group?: string
}

export interface UptimeGroupResult {
  categoryName: string
  monitors: UptimeMonitor[]
}

// ============================================================================
// Dashboard Filter Types
// ============================================================================

export interface DashboardFilters {
  start_timestamp?: Date
  end_timestamp?: Date
  time_granularity?: TimeGranularity
  username?: string
}

export type ConsumptionDistributionChartType = 'bar' | 'area'

export type ModelAnalyticsChartTab = 'trend' | 'proportion' | 'top'

export interface DashboardChartPreferences {
  consumptionDistributionChart: ConsumptionDistributionChartType
  modelAnalyticsChart: ModelAnalyticsChartTab
  defaultTimeRangeDays: number
  defaultTimeGranularity: TimeGranularity
}

// ============================================================================
// API Info Types
// ============================================================================

export interface ApiInfoItem {
  url: string
  route: string
  description: string
  color: string
}

export interface PingStatus {
  latency: number | null
  testing: boolean
  error: boolean
}

export type PingStatusMap = Record<string, PingStatus>

// ============================================================================
// Chart Types
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VChartSpec = Record<string, any>

export interface ProcessedChartData {
  spec_pie: VChartSpec
  spec_line: VChartSpec
  spec_area: VChartSpec
  spec_model_line: VChartSpec
  spec_rank_bar: VChartSpec
  totalQuotaDisplay: string
  totalCountDisplay: string
}

export interface ProcessedUserChartData {
  spec_user_rank: VChartSpec
  spec_user_trend: VChartSpec
}

// ============================================================================
// Announcement Types
// ============================================================================

export interface AnnouncementItem {
  id?: number
  content: string
  publishDate?: string
  type?: 'default' | 'ongoing' | 'success' | 'warning' | 'error'
  extra?: string
}

// ============================================================================
// FAQ Types
// ============================================================================

export interface FAQItem {
  id?: number
  question: string
  answer: string
}
