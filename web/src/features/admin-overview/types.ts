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

/**
 * Aggregated quota row returned by `GET /api/data` (admin).
 *
 * The backend groups hourly quota_data rows by model, so `quota` and
 * `token_used` are integer sums in quota units, never USD floats.
 */
export interface OverviewQuotaRow {
  model_name?: string
  created_at: number
  count?: number
  quota?: number
  token_used?: number
}

/**
 * Aggregated quota row returned by `GET /api/data/users` (admin),
 * grouped by username and hour.
 */
export interface OverviewUserRow {
  username?: string
  created_at: number
  count?: number
  quota?: number
  token_used?: number
}

/** Response data of `GET /api/log/stat` (admin). */
export interface AdminLogStat {
  quota: number
  rpm: number
  tpm: number
}

/** Integer usage totals kept in raw quota units / token counts. */
export interface UsageTotals {
  quota: number
  tokens: number
  requests: number
}

/** One day of the revenue trend. `quota` stays an exact integer. */
export interface DailyRevenuePoint {
  day: string
  label: string
  quota: number
}

/** One month of the revenue trend. `quota` stays an exact integer. */
export interface MonthlyRevenuePoint {
  month: number
  year: number
  label: string
  quota: number
}

/** One chart series of the token usage chart. */
export interface TokenSeriesEntry {
  key: string
  model: string
}

/** One hour of token usage, split by series key. */
export interface TokenSeriesPoint {
  label: string
  total: number
  values: Record<string, number>
}

export interface TokenUsageSeries {
  series: TokenSeriesEntry[]
  points: TokenSeriesPoint[]
}

/** Consumption per model, ordered by token usage. */
export interface ModelUsage {
  model: string
  quota: number
  tokens: number
  requests: number
}

/** Distinct active users for one hour in the last 24 hours. */
export interface HourlyActivityPoint {
  label: string
  activeUsers: number
}

// ============================================================================
// Flow Analytics Types
// ============================================================================

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
