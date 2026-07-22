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
  cost_ratio: number | null
  previous_cost_ratio: number | null
  conversion_factor: number | null
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

export type ChannelMonitorUpstreamType = 'new_api' | 'sub2api' | 'custom'

export type ChannelMonitorUpstreamAuthType =
  | 'public'
  | 'user'
  | 'api_key'
  | 'account'
  | 'token'
  | 'custom'

export type ChannelMonitorCustomSource = 'fixed' | 'http'
export type ChannelMonitorCustomBodyType = 'none' | 'json' | 'form'
export type ChannelMonitorCustomResponseType = 'json' | 'text'

export type ChannelMonitorCustomKeyValue = {
  key: string
  value: string
  secret: boolean
  has_value: boolean
}

export type ChannelMonitorCustomRequestConfig = {
  method: 'GET' | 'POST'
  path: string
  query: ChannelMonitorCustomKeyValue[]
  headers: ChannelMonitorCustomKeyValue[]
  body_type: ChannelMonitorCustomBodyType
  body: string
  body_secret: boolean
  has_body: boolean
  form: ChannelMonitorCustomKeyValue[]
}

export type ChannelMonitorCustomResultConfig = {
  response_type: ChannelMonitorCustomResponseType
  value_path: string
  multiplier: number
}

export type ChannelMonitorCustomMetricConfig = {
  source: ChannelMonitorCustomSource
  fixed_value?: number
  request?: ChannelMonitorCustomRequestConfig
  result?: ChannelMonitorCustomResultConfig
}

export type ChannelMonitorCustomUpstreamConfig = {
  version: 1
  ratio: ChannelMonitorCustomMetricConfig
  balance: ChannelMonitorCustomMetricConfig
  balance_reuse_ratio_request: boolean
}

export type ChannelMonitorCostConversion =
  | { mode: 'none' }
  | {
      mode: 'recharge'
      paid_cny: number
      credited_usd: number
    }
  | {
      mode: 'subscription'
      subscription_period: 'day' | 'week' | 'month'
      subscription_price_cny: number
      subscription_daily_usd: number
    }

export type ChannelMonitorUpstreamConfig = {
  type: ChannelMonitorUpstreamType
  base_url: string
  group: string
  auth_type: ChannelMonitorUpstreamAuthType
  user_id: number
  has_access_token: boolean
  account: string
  has_password: boolean
  single_channel_action: ChannelMonitorPolicyAction
  multiple_channels_action: ChannelMonitorPolicyAction
  balance_warning_threshold: number | null
  balance_auto_disable_threshold: number | null
  ratio_sync_enabled: boolean
  balance_sync_enabled: boolean
  cost_conversion: ChannelMonitorCostConversion
  custom_config?: ChannelMonitorCustomUpstreamConfig
}

export type ChannelMonitorUpstreamRequest = {
  type: ChannelMonitorUpstreamType
  base_url: string
  group: string
  auth_type: ChannelMonitorUpstreamAuthType
  user_id: number
  access_token: string
  account: string
  password: string
  single_channel_action: ChannelMonitorPolicyAction
  multiple_channels_action: ChannelMonitorPolicyAction
  balance_warning_threshold: number | null
  balance_auto_disable_threshold: number | null
  ratio_sync_enabled: boolean
  balance_sync_enabled: boolean
  cost_conversion: ChannelMonitorCostConversion
  custom_config?: ChannelMonitorCustomUpstreamConfig
}

export type ChannelMonitorCustomRequestDebug = {
  status_code: number
  duration_ms: number
  response_preview?: string
}

export type ChannelMonitorUpstreamVersionResult = {
  version: string
  endpoint: string
}

export type NewAPIGroupRatioResult = {
  ratio: number
  cost_ratio: number
  conversion_factor: number
  endpoint: string
  balance: ChannelMonitorUpstreamBalanceResult
  debug?: ChannelMonitorCustomRequestDebug
}

export type ChannelMonitorUpstreamBalanceResult = {
  amount: number | null
  endpoint?: string
  error?: string
  debug?: ChannelMonitorCustomRequestDebug
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

export type ChannelMonitorPerformanceRangeMinutes = number

export type ChannelMonitorSmartSchedulePerformanceRangeMinutes =
  | 15
  | 60
  | 360
  | 1440

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

export type ChannelMonitorSuccessSummary = {
  actual_success_count: number
  actual_failure_count: number
  actual_sample_count: number
  actual_success_rate: number
  final_success_count: number
  final_failure_count: number
  final_sample_count: number
  final_success_rate: number
}

export type ChannelMonitorSuccessMetric = ChannelMonitorSuccessSummary & {
  channel_id: number
  model_name: string
}

export type ChannelMonitorGroupSuccessMetric = ChannelMonitorSuccessSummary & {
  group: string
}

export type ChannelMonitorChannelSuccessMetric =
  ChannelMonitorSuccessSummary & {
    channel_id: number
  }

export type ChannelMonitorFailureCategory = {
  channel_id: number
  status_code: number
  error_type: string
  error_code: string
  sample_content: string
  actual_count: number
  final_count: number
  last_occurred_at: number
}

export type ChannelMonitorSuccessDetail = {
  summary: ChannelMonitorSuccessSummary
  channel_items: ChannelMonitorChannelSuccessMetric[]
  failure_categories: ChannelMonitorFailureCategory[]
}

export type ChannelMonitorSuccessDetailResult = {
  range_minutes: ChannelMonitorPerformanceRangeMinutes
  generated_at: number
  success_metrics_available: boolean
  scope: 'channel' | 'group' | ''
  detail: ChannelMonitorSuccessDetail
}

export type ChannelMonitorSuccessMode = 'actual' | 'final'

export type ChannelMonitorSuccessDetailTarget =
  | {
      scope: 'channel'
      mode: 'actual'
      channelId: number
      channelName: string
      modelName?: string
    }
  | {
      scope: 'group'
      mode: ChannelMonitorSuccessMode
      groupName: string
    }

export type ChannelMonitorPerformanceResult = {
  range_minutes: ChannelMonitorPerformanceRangeMinutes
  generated_at: number
  items: ChannelMonitorPerformanceMetric[]
  success_metrics_available: boolean
  success_items: ChannelMonitorSuccessMetric[]
  group_success_items: ChannelMonitorGroupSuccessMetric[]
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
  auto_disable_on_update_failure: boolean
  email_notification_enabled: boolean
  notification_email: string
  smart_schedule_enabled: boolean
  smart_schedule_interval_minutes: number
  smart_schedule_strategy: ChannelMonitorSmartScheduleStrategy
  smart_schedule_stability_enabled: boolean
  smart_schedule_apply_mode: ChannelMonitorSmartScheduleApplyMode
  smart_schedule_performance_minutes: ChannelMonitorSmartSchedulePerformanceRangeMinutes
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
  cost_ratio: number
  conversion_factor: number
  coefficient: number
  ratio: number
}

export type ChannelMonitorGroupChannelsUpdateResult = {
  group: string
  channel_ids: number[]
  added_channel_ids: number[]
  removed_channel_ids: number[]
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
