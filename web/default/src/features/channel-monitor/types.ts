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
export type ChannelMonitorItem = {
  id: number
  name: string
  type: number
  status: number
  priority: number
  weight: number
  base_url: string
  models: string
  test_model: string | null
  groups: string[]
  ratio: number | null
  previous_ratio: number | null
  remark: string
  channel_remark: string
  updated_time: number
  updated_by: number
  updated_by_username: string
  last_fetch_status: '' | 'succeeded' | 'failed'
  last_fetch_error: string
  last_fetch_time: number
  consecutive_failures: number
  upstream_balance: number | null
  last_balance_time: number
  last_balance_error: string
  smart_schedule_excluded: boolean
  last_schedule_status: '' | 'succeeded' | 'skipped' | 'failed'
  last_schedule_error: string
  last_schedule_score: number | null
  last_schedule_priority: number
  last_schedule_weight: number
  last_schedule_time: number
  upstream: ChannelMonitorUpstreamConfig | null
}

export type ChannelMonitorUpstreamType = 'new_api' | 'sub2api'

export type ChannelMonitorUpstreamAuthType =
  | 'public'
  | 'user'
  | 'api_key'
  | 'token'

export type ChannelMonitorUpstreamConfig = {
  type: ChannelMonitorUpstreamType
  base_url: string
  group: string
  auth_type: ChannelMonitorUpstreamAuthType
  user_id: number
  has_access_token: boolean
  single_channel_action: ChannelMonitorPolicyAction
  multiple_channels_action: ChannelMonitorPolicyAction
  balance_warning_threshold: number | null
  ratio_sync_enabled: boolean
  balance_sync_enabled: boolean
}

export type ChannelMonitorUpstreamRequest = {
  type: ChannelMonitorUpstreamType
  base_url: string
  group: string
  auth_type: ChannelMonitorUpstreamAuthType
  user_id: number
  access_token: string
  single_channel_action: ChannelMonitorPolicyAction
  multiple_channels_action: ChannelMonitorPolicyAction
  balance_warning_threshold: number | null
  ratio_sync_enabled: boolean
  balance_sync_enabled: boolean
}

export type ChannelMonitorUpstreamVersionResult = {
  version: string
  endpoint: string
}

export type NewAPIGroupRatioResult = {
  ratio: number
  endpoint: string
  balance: ChannelMonitorUpstreamBalanceResult
}

export type ChannelMonitorUpstreamBalanceResult = {
  amount: number | null
  endpoint?: string
  error?: string
}

export type ChannelMonitorUpstreamGroup = {
  id?: string
  name: string
  ratio: number
}

export type ChannelMonitorUpstreamGroupsResult = {
  groups: ChannelMonitorUpstreamGroup[]
  balance: ChannelMonitorUpstreamBalanceResult
  applied_group?: string
  applied_group_error?: string
}

export type ChannelMonitorFetchResult = {
  result: NewAPIGroupRatioResult
  monitor: {
    ratio: number
    previous_ratio: number | null
    updated_time: number
  }
  created: boolean
  changed: boolean
}

export type ChannelMonitorApplyGroupResult = ChannelMonitorFetchResult & {
  keys_updated: number
}

export type ChannelMonitorOverview = {
  channels: ChannelMonitorItem[]
  channel_order: number[]
  group_ratios: Record<string, number>
  group_coefficients: Record<string, number>
  settings: ChannelMonitorSettings
}

export type ChannelMonitorPerformanceRangeMinutes = 15 | 60 | 360 | 1440

export type ChannelMonitorPerformanceMetric = {
  channel_id: number
  model_name: string
  sample_count: number
  first_token_sample_count: number
  tps_sample_count: number
  average_first_token_ms: number | null
  average_tps: number | null
  latest_first_token_ms: number | null
  latest_tps: number | null
  last_used_time: number
}

export type ChannelMonitorPerformanceResult = {
  range_minutes: ChannelMonitorPerformanceRangeMinutes
  generated_at: number
  items: ChannelMonitorPerformanceMetric[]
}

export type ChannelMonitorChannelPerformance = {
  sample_count: number
  first_token_sample_count: number
  tps_sample_count: number
  average_first_token_ms: number | null
  average_tps: number | null
  last_used_time: number
}

export type ChannelMonitorSortMode =
  | 'custom'
  | 'channel_asc'
  | 'channel_desc'
  | 'ratio_asc'
  | 'ratio_desc'
  | 'first_token_asc'
  | 'first_token_desc'
  | 'tps_asc'
  | 'tps_desc'

export type ChannelMonitorPolicyAction =
  | 'none'
  | 'update_group_ratio'
  | 'disable_channel'

export type ChannelMonitorSettings = {
  auto_update_interval_minutes: number
  auto_update_retry_count: number
  email_notification_enabled: boolean
  notification_email: string
  smart_schedule_enabled: boolean
  smart_schedule_interval_minutes: number
  smart_schedule_strategy: ChannelMonitorSmartScheduleStrategy
  smart_schedule_stability_enabled: boolean
  smart_schedule_apply_mode: ChannelMonitorSmartScheduleApplyMode
  smart_schedule_performance_minutes: ChannelMonitorPerformanceRangeMinutes
  smart_schedule_model: string
  smart_schedule_min_samples: number
  smart_schedule_force_reset_task_created?: boolean
  smart_schedule_force_reset_task_id?: string
  smart_schedule_force_reset_task_error?: string
}

export type ChannelMonitorSmartScheduleStrategy =
  | 'ratio'
  | 'first_token'
  | 'tps'
  | 'smart'

export type ChannelMonitorSmartScheduleApplyMode = 'weight' | 'priority_weight'

export type ChannelMonitorSmartScheduleConfig = {
  excluded: boolean
}

export type ChannelMonitorTaskRunResult = {
  created: boolean
  task: ChannelMonitorTask
}

export type ChannelMonitorGroupRatioSyncResult = {
  group: string
  upstream_ratio: number
  coefficient: number
  ratio: number
}

export type ChannelMonitorTaskStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'

export type ChannelMonitorTaskProgress = {
  total: number
  processed: number
  progress: number
}

export type ChannelMonitorTaskResult = {
  total: number
  updated: number
  changed?: number
  balance_updated?: number
  balance_warnings?: number
  failed: number
  groups_updated?: number
  group_update_failed?: boolean
  channels_disabled?: number
  groups_skipped?: number
  retried?: number
  recovered_after_retry?: number
  strategy?: ChannelMonitorSmartScheduleStrategy | 'stability'
  stability_enabled?: boolean
  force_reset?: boolean
  apply_mode?: ChannelMonitorSmartScheduleApplyMode
  model?: string
  performance_minutes?: number
  min_samples?: number
  planned?: number
  unchanged?: number
  skipped?: number
  failures?: ChannelMonitorTaskFailure[]
  failure_details_truncated?: boolean
  email_status?: 'sent' | 'failed'
  email_error?: string
}

export type ChannelMonitorTaskFailure = {
  channel_id: number
  channel_name: string
  error: string
}

export type ChannelMonitorTask = {
  id: number
  task_id: string
  type: 'channel_ratio_monitor' | 'channel_smart_schedule'
  status: ChannelMonitorTaskStatus
  state: ChannelMonitorTaskProgress | null
  result: ChannelMonitorTaskResult | null
  error: string
  created_at: number
  updated_at: number
}

export type ChannelMonitorTaskKind = 'ratio' | 'schedule'

export type ChannelMonitorTaskPage = {
  page: number
  page_size: number
  total: number
  items: ChannelMonitorTask[]
}

export type ChannelRatioHistory = {
  id: number
  channel_id: number
  old_ratio: number
  new_ratio: number
  remark: string
  created_time: number
  operator_id: number
  operator_username: string
}

export type ChannelRatioHistoryPage = {
  page: number
  page_size: number
  total: number
  items: ChannelRatioHistory[]
}

export type ChannelMonitorApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export type GroupMonitorItem = {
  name: string
  ratio: number
  coefficient: number
  channels: ChannelMonitorItem[]
}
