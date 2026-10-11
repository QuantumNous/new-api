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
  use_group?: string
  channel_id?: number
  channel_name?: string
  // Cache billing counters. Both are 0 for rows written before the columns
  // existed, and input_tokens_total only accumulates for requests whose
  // upstream reported cache metadata — so a zero denominator means
  // "no cache data", not "0% hit rate".
  cache_read_tokens?: number
  input_tokens_total?: number
}

export interface FlowQuotaDataItem {
  user_id?: number
  username?: string
  node_name?: string
  use_group?: string
  token_id?: number
  token_name?: string
  channel_id?: number
  channel_name?: string
  model_name?: string
  token_used?: number
  count?: number
  quota?: number
}

export type FlowMetric = 'quota' | 'tokens' | 'requests'

// ----------------------------------------------------------------------------
// Realtime throughput
//
// These come from in-process counters, not from quota_data. The backend keeps
// one ring buffer per active user and only ever reports the traffic this node
// served itself, so NodeName identifies the instance behind the numbers.
// ----------------------------------------------------------------------------

export interface RealtimeWindow {
  window_seconds: number
  requests: number
  tokens: number
  rpm: number
  tpm: number
  cache_read_tokens: number
  input_tokens_total: number
  // 0-1 ratio, or null when no request in the window reported cache metadata.
  // null and 0 mean different things: null is "not measured", 0 is a real
  // observed miss, and the UI must not render the former as the latter.
  cache_hit_rate: number | null
}

export interface RealtimeBucket {
  timestamp: number
  requests: number
  tokens: number
  // Raw terms rather than a ratio, so several buckets can be re-aggregated
  // before dividing without needing to weight per-bucket rates.
  cache_read_tokens: number
  input_tokens_total: number
}

export interface RealtimeSnapshot {
  user_id: number
  now: number
  node_name: string
  windows: RealtimeWindow[]
  series: RealtimeBucket[]
  // Echo of the filter this snapshot was built under. A client polling with a
  // filter compares these against its current selection so a response that
  // arrives after the user switched keys can be discarded rather than rendered
  // under the wrong label.
  token_id?: number
  model?: string
}

// One selectable key or model, with its request count so the picker can order
// by activity rather than alphabetically.
export interface RealtimeDimensionOption {
  token_id?: number
  token_name?: string
  model?: string
  requests: number
}

export interface RealtimeDimensions {
  tokens: RealtimeDimensionOption[]
  models: RealtimeDimensionOption[]
  // The breakdown hit its ring cap, so some combinations are missing from
  // these lists even though their traffic is still counted in the totals.
  truncated: boolean
}

// ----------------------------------------------------------------------------
// Historical usage
//
// The long-range counterpart to the realtime snapshot. It reads the hourly
// quota_data rollup, so it can answer for any range but cannot resolve finer
// than an hour — which is also why spend lives here and not in the rings.
// ----------------------------------------------------------------------------

export interface UsageStatsBucket {
  timestamp: number
  requests: number
  tokens: number
  quota: number
  cache_read_tokens: number
  input_tokens_total: number
  // Averages across the bucket, not peaks: an hourly bucket smooths bursts
  // away entirely, so the realtime panel is what to read for live load.
  rpm: number
  tpm: number
}

export interface UsageStatsTotals {
  requests: number
  tokens: number
  quota: number
  cache_read_tokens: number
  input_tokens_total: number
  rpm: number
  tpm: number
  // null means no request in the range reported cache metadata, which is not
  // the same as a 0% rate; see RealtimeWindow.
  cache_hit_rate: number | null
}

export interface UsageStatsOption {
  token_id?: number
  token_name?: string
  model?: string
  requests: number
  quota: number
}

export interface UsageStatsResult {
  start_time: number
  end_time: number
  bucket_seconds: number
  token_id?: number
  model?: string
  totals: UsageStatsTotals
  series: UsageStatsBucket[]
  tokens: UsageStatsOption[]
  models: UsageStatsOption[]
}

export interface RealtimeUserSummary {
  user_id: number
  username: string
  requests: number
  tokens: number
  rpm: number
  tpm: number
  last_seen: number
}

export interface RealtimeUsersResponse {
  window_seconds: number
  node_name: string
  now: number
  users: RealtimeUserSummary[]
}

export type FlowOverflowMode = 'aggregate' | 'hide'

export type FlowRole = 'user' | 'admin' | 'root'

export type FlowNodeKind =
  | 'user'
  | 'node'
  | 'token'
  | 'group'
  | 'model'
  | 'channel'

export interface FlowNodeFilter {
  kind: FlowNodeKind
  id: string
}

export interface FlowLinkSelection {
  source: string
  target: string
}

export interface FlowBuildOptions {
  role?: FlowRole
  selectedUsers?: string[]
  selectedNodes?: FlowNodeFilter[]
  activeNode?: FlowNodeFilter
  activeLink?: FlowLinkSelection
  colorPalette?: readonly string[]
  visibleStages?: FlowNodeKind[]
  topNodeLimit?: number
  overflowMode?: FlowOverflowMode
  // When true, sensitive node labels (users, tokens, nodes, groups, channels)
  // are partially masked in the rendered graph while keeping node identity so
  // the Sankey shape stays intact.
  maskSensitive?: boolean
  // Resolves the label for a token whose record no longer exists (deleted).
  // Lets the caller inject a localized string such as "Deleted (123)".
  deletedTokenLabel?: (tokenId: number) => string
  otherNodeLabel?: (kind: FlowNodeKind) => string
}

export interface DashboardFlowNode {
  id: string
  label: string
  kind: FlowNodeKind
  value: number
  requests: number
  quota: number
  tokens: number
  color: string
  colorKey: string
  highlighted?: boolean
  dimmed?: boolean
}

export interface DashboardFlowLink {
  source: string
  target: string
  value: number
  requests: number
  quota: number
  tokens: number
  sourceLabel: string
  targetLabel: string
  color: string
  linkColor: string
  linkAlpha: number
  hoverColor: string
  colorKey: string
  share: number
  highlighted?: boolean
  dimmed?: boolean
}

export interface DashboardFlowGraph {
  nodes: DashboardFlowNode[]
  links: DashboardFlowLink[]
}

export interface FlowUserFilterOption {
  value: string
  label: string
  valueLabel: string
  valueRaw: number
  color: string
}

export interface FlowNodeFilterOption {
  kind: FlowNodeKind
  value: string
  label: string
  valueLabel: string
  valueRaw: number
  color: string
}

export interface FlowFilterOptions {
  users: FlowUserFilterOption[]
  nodes: FlowNodeFilterOption[]
}

export interface FlowSummary {
  quota: number
  tokens: number
  requests: number
}

export interface ProcessedFlowData {
  summary: FlowSummary
  flow: DashboardFlowGraph
  filterOptions: FlowFilterOptions
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
  token_name?: string
  model_name?: string
}

export type ConsumptionDistributionChartType = 'bar' | 'area'

export type ModelAnalyticsChartTab = 'trend' | 'proportion' | 'top'

export interface DashboardChartPreferences {
  consumptionDistributionChart: ConsumptionDistributionChartType
  modelAnalyticsChart: ModelAnalyticsChartTab
  defaultTimeRangeDays: number
  defaultTimeGranularity: TimeGranularity
}

// User analytics selections are held by the dashboard parent so they survive
// switching between dashboard sub-sections, matching the model/flow filters.
export interface UserChartsFilters {
  timeGranularity: TimeGranularity
  selectedRange: number
  topUserLimit: number
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
