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
export type UpstreamSource = {
  id: number
  key: string
  name: string
  console_url: string
  selected_endpoint?: string
  status: string
  enabled: boolean
  balance?: number
  low_balance_threshold: number
  last_snapshot_at: number
  last_success_at: number
  last_error?: string
}

export type UpstreamGroup = {
  id: number
  source_id: number
  external_id: string
  name: string
  platform: string
  effective_multiplier: number
  health_status: string
  availability?: number
  latency_ms?: number
  models: string
  observed_at: number
}

export type UpstreamRoute = {
  id: number
  source_id: number
  external_group_id: string
  platform: string
  protocol: string
  channel_id: number
  state: string
  detached: boolean
  rank: number
  effective_multiplier: number
  effective_models: string[] | null
  consecutive_failures: number
  consecutive_successes: number
  last_success_at?: number
  last_probe_at?: number
  next_probe_at?: number
  manual_pause_until?: number
  last_reason?: string
}

export type UpstreamDevice = {
  device_id: string
  name: string
  status: string
  last_seen_at?: number
  created_at: number
}

export type UpstreamCommand = {
  command_id: string
  type: string
  source_key?: string
  status: string
  error?: string
  created_at: number
}

export type UpstreamSettings = {
  enabled: boolean
  auto_enroll: boolean
  target_groups: string[]
  candidate_limit: number
  request_attempt_limit: number
  failover_budget_seconds: number
  probe_freshness_minutes: number
  failure_threshold: number
  failure_window_minutes: number
  red_long_term_hours: number
  sync_interval_hours: number
  daily_reconcile_time: string
  timezone: string
  model_aliases: Record<string, string>
  model_exclusions: Record<string, string[]>
  protocol_model_exclusions: Record<string, string[]>
}

export type UpstreamRoutingPolicy = Pick<
  UpstreamSettings,
  | 'target_groups'
  | 'model_aliases'
  | 'model_exclusions'
  | 'protocol_model_exclusions'
>

export type UpstreamOverview = {
  settings: UpstreamSettings
  sources: UpstreamSource[]
  groups: UpstreamGroup[]
  routes: UpstreamRoute[]
  devices: UpstreamDevice[]
  commands: UpstreamCommand[]
  bark_configured: boolean
}

export type UpstreamMetric = {
  id: number
  source_id: number
  external_group_id?: string
  model_name?: string
  protocol?: string
  health_status?: string
  rate_multiplier?: number
  balance?: number
  input_tokens?: number
  output_tokens?: number
  cached_tokens?: number
  total_tokens?: number
  usage_5h?: number
  limit_5h?: number
  usage_7d?: number
  limit_7d?: number
  usage_30d?: number
  limit_30d?: number
  data_quality: 'reported' | 'estimated' | 'unavailable'
  observed_at: number
}

export type UpstreamPriceEvidence = {
  id: number
  vendor: string
  model_name: string
  normalized_price: string
  previous_price?: string
  source_url: string
  evidence_hash: string
  status: string
  error?: string
  captured_at: number
  applied_at?: number
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}
