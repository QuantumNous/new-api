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

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

export type ChannelContributionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'unavailable'
  | 'deleted'

export type ChannelContributionRevisionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'superseded'

export type ChannelContributionTestRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'passed'
  | 'cancelled'
  | 'stale'

export type ChannelContributionProbeResult = {
  success?: boolean
  passed?: boolean
  status?: string
  latency_ms?: number
  response_time?: number
  response_time_ms?: number
  error?: string
  message?: string
}

export type ChannelContributionRawTestResult = {
  id?: number | string
  model: string
  endpoint_type?: string
  stream: boolean
  success: boolean
  latency_ms?: number
  error?: string
}

export type ChannelContributionModelTestResult = {
  model: string
  endpoint_type?: string
  stream_required?: boolean
  non_stream?: ChannelContributionProbeResult | null
  stream?: ChannelContributionProbeResult | null
  price_configured?: boolean
}

export type ChannelContributionTestRun = {
  id?: number | string
  run_id?: number | string
  contribution_id?: number
  revision_id?: number
  revision?: number
  config_hash?: string
  actor_id?: number
  actor_type?: 'user' | 'admin' | string
  status: ChannelContributionTestRunStatus
  pricing_ready?: boolean
  price_configured?: boolean
  total?: number
  passed?: number
  failed?: number
  results?: Array<
    ChannelContributionModelTestResult | ChannelContributionRawTestResult
  >
  model_results?: ChannelContributionModelTestResult[]
  created_at?: number
  started_at?: number
  completed_at?: number
  updated_at?: number
  error?: string
  message?: string
}

export type ChannelContributionRevision = {
  id: number
  contribution_id?: number
  revision_number?: number
  name: string
  type: number
  base_url: string
  key?: string
  has_api_key?: boolean
  group: string
  models: string[] | string
  model_mapping: Record<string, string> | string
  config_hash?: string
  status?: ChannelContributionRevisionStatus
  price_configured?: boolean
  unpriced_models?: string[]
  agreement_version?: string
  agreement_hash?: string
  agreement_accepted_at?: number
  submitted_at?: number
  reviewer_id?: number
  reviewer_username?: string
  reviewed_at?: number
  review_reason?: string
  created_at?: number
  updated_at?: number
}

export type ChannelContributionModelHealth = {
  id?: number | string
  contribution_id?: number
  channel_id?: number
  model: string
  healthy: boolean
  failure_since?: number
  last_checked_at?: number
  last_success_at?: number
  last_failure_at?: number
  last_error?: string
  created_at?: number
  updated_at?: number
}

export type ChannelContribution = {
  id: number
  user_id?: number
  username?: string
  status: ChannelContributionStatus
  revision_status?: ChannelContributionRevisionStatus
  channel_id?: number | null
  current_revision_id?: number | null
  pending_revision_id?: number | null
  approved_revision_id?: number | null
  current_revision?: ChannelContributionRevision | null
  pending_revision?: ChannelContributionRevision | null
  approved_revision?: ChannelContributionRevision | null
  latest_test_run?: ChannelContributionTestRun | null
  test_run?: ChannelContributionTestRun | null
  submitted_at?: number
  reviewer_id?: number
  reviewer_username?: string
  reviewed_at?: number
  review_reason?: string
  unavailable_since?: number
  last_health_check_at?: number
  last_health_error?: string
  model_health?: ChannelContributionModelHealth[]
  created_at?: number
  updated_at?: number
  name?: string
  type?: number
  base_url?: string
  key?: string
  group?: string
  models?: string[] | string
  model_mapping?: Record<string, string> | string
  revision?: number
  config_hash?: string
}

export type ChannelContributionList = {
  items: ChannelContribution[]
  total: number
  page?: number
  page_size?: number
}

export type ChannelContributionConfig = {
  enabled?: boolean
  allowed_groups: string[]
  allowed_channel_types: Array<{ value: number; label: string }>
  max_models?: number
  test_result_ttl_seconds?: number
  probe_timeout_seconds?: number
  unavailable_delete_hours: number
  health_check_interval_minutes?: number
  agreement_version: string
  agreement_content: string
  agreement_hash?: string
  reward_bps?: number
}

export type ChannelContributionAdminSettings = {
  tag: string
  allowed_groups: string[]
  allowed_channel_types: number[]
  priority: number
  weight: number
  unavailable_delete_hours: number
  health_check_interval_minutes: number
  reward_bps: number
  agreement_version: string
  agreement_content: string
  supported_channel_types?: Array<{ value: number; label: string }>
}

export type ChannelContributionPayload = {
  name: string
  type: number
  base_url: string
  api_key?: string
  group: string
  models: string[]
  model_mapping: Record<string, string>
}

export type ChannelContributionSubmitPayload = {
  test_run_id: number | string
  agreement_version: string
  agreement_accepted: true
}

export type ChannelContributionFetchModelsResult = {
  models: string[]
}

export type ChannelContributionRewardAccount = {
  user_id?: number
  balance: number
  lifetime_earned: number
  lifetime_transferred: number
  created_at?: number
  updated_at?: number
}

export type ChannelContributionRewardEntry = {
  id: number
  user_id?: number
  contribution_id?: number
  channel_id?: number
  contribution_name?: string
  request_id?: string
  entry_type?: 'earn' | 'transfer' | string
  amount: number
  balance_after?: number
  source_quota?: number
  reward_bps?: number
  created_at?: number
}

export type ChannelContributionRewardSummary = {
  account: ChannelContributionRewardAccount
  items: ChannelContributionRewardEntry[]
  total: number
}

export type ChannelContributionRewardTransfer = ChannelContributionRewardEntry

export type ChannelContributionRewardTransferList = {
  items: ChannelContributionRewardTransfer[]
  total: number
}
