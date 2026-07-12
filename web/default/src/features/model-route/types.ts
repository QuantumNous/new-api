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
export type ModelRoutePolicy = {
  channel_id: number
  channel_name?: string
  base_url?: string
  requested_model: string
  manual_priority: number
  enabled: boolean
  source: string
  created_at?: number
  updated_at?: number
}

export type ModelRouteMetrics = {
  channel_id: number
  channel_name?: string
  base_url?: string
  effective_model: string
  route_state: string
  role?: string
  is_stale?: boolean
  experience_score?: number | null
  production_success_ema?: number | null
  production_ttft_ema_ms?: number | null
  rate_limit_ema?: number | null
  stream_interruption_ema?: number | null
  cooldown_until?: number | null
  last_success_at?: number | null
  last_probe_at?: number | null
  last_request_at?: number | null
}

export type UpdatePolicyPriorityRequest = {
  channel_id: number
  requested_model: string
  manual_priority: number
}

export type MetricsActionRequest = {
  channel_id: number
  effective_model: string
  action: 'trip_open' | 'force_probe' | 'manual_disable' | 'restore_auto'
}

export type ResetLearningRequest = {
  channel_id?: number
  effective_model?: string
  confirm?: boolean
}
