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

export type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

export type ChannelMonitorProvider = 'openai' | 'anthropic' | 'gemini'
export type ChannelMonitorApiMode = 'chat_completions' | 'responses'
export type ChannelMonitorBodyOverrideMode = 'off' | 'merge' | 'replace'
export type ChannelMonitorStatus =
  | 'operational'
  | 'degraded'
  | 'failed'
  | 'error'
  | 'unknown'
  | 'disabled'

export type ExtraModelStatus = {
  model: string
  status: ChannelMonitorStatus | ''
  latency_ms?: number | null
}

export type ChannelMonitor = {
  id: number
  name: string
  provider: ChannelMonitorProvider
  api_mode: ChannelMonitorApiMode
  endpoint: string
  api_key_masked: string
  api_key_decrypt_failed: boolean
  primary_model: string
  extra_models: string[]
  group_name: string
  enabled: boolean
  user_visible: boolean
  interval_seconds: number
  jitter_seconds: number
  last_checked_at?: string | null
  created_by: number
  created_at: string
  updated_at: string
  primary_status: ChannelMonitorStatus
  primary_latency_ms?: number | null
  availability_7d: number
  extra_model_statuses: ExtraModelStatus[]
  template_id?: number | null
  extra_headers: Record<string, string>
  body_override_mode: ChannelMonitorBodyOverrideMode
  body_override?: Record<string, unknown> | null
}

export type ChannelMonitorListParams = {
  p?: number
  page_size?: number
  provider?: string
  enabled?: boolean
  search?: string
}

export type ChannelMonitorListData = {
  items: ChannelMonitor[]
  total: number
  page: number
  page_size: number
}

export type ChannelMonitorPayload = {
  name: string
  provider: ChannelMonitorProvider
  api_mode: ChannelMonitorApiMode
  endpoint: string
  api_key?: string
  primary_model: string
  extra_models: string[]
  group_name: string
  enabled: boolean
  user_visible: boolean
  interval_seconds: number
  jitter_seconds: number
  template_id?: number | null
  extra_headers?: Record<string, string>
  body_override_mode?: ChannelMonitorBodyOverrideMode
  body_override?: Record<string, unknown> | null
}

export type ChannelMonitorUpdatePayload = Partial<ChannelMonitorPayload> & {
  clear_template?: boolean
}

export type ChannelMonitorRunResult = {
  model: string
  status: ChannelMonitorStatus
  latency_ms?: number | null
  ping_latency_ms?: number | null
  message: string
  checked_at: string
}

export type ChannelMonitorHistory = {
  id: number
  monitor_id: number
  model: string
  status: ChannelMonitorStatus
  latency_ms?: number | null
  ping_latency_ms?: number | null
  message: string
  checked_at: string
}

export type ChannelMonitorHistoryData = {
  items: ChannelMonitorHistory[]
}

export type ChannelMonitorTimelinePoint = {
  status: ChannelMonitorStatus
  latency_ms?: number | null
  ping_latency_ms?: number | null
  checked_at: string
}

export type UserChannelMonitor = {
  id: number
  name: string
  provider: ChannelMonitorProvider
  group_name: string
  admin_only: boolean
  primary_model: string
  primary_status: ChannelMonitorStatus
  primary_latency_ms?: number | null
  primary_ping_latency_ms?: number | null
  last_checked_at?: string | null
  availability_7d: number
  availability_15d: number
  availability_30d: number
  extra_models: ExtraModelStatus[]
  timeline: ChannelMonitorTimelinePoint[]
}

export type UserChannelMonitorSummary = {
  overall_state: ChannelMonitorStatus
  monitored_count: number
  operational_count: number
  degraded_count: number
  failed_count: number
  error_count: number
  unknown_count: number
  last_checked_at?: string | null
}

export type UserChannelMonitorStatusData = {
  enabled: boolean
  refreshed_at: string
  summary: UserChannelMonitorSummary
  monitors: UserChannelMonitor[]
}

export type UserChannelMonitorModelDetail = {
  model: string
  latest_status: ChannelMonitorStatus
  latest_latency_ms?: number | null
  latest_ping_ms?: number | null
  latest_checked_at?: string | null
  availability_7d: number
  availability_15d: number
  availability_30d: number
  avg_latency_7d_ms?: number | null
}

export type UserChannelMonitorDetailData = {
  enabled: boolean
  monitor: {
    id: number
    name: string
    provider: ChannelMonitorProvider
    group_name: string
    admin_only: boolean
    models: UserChannelMonitorModelDetail[]
  }
}

export type ChannelMonitorTemplate = {
  id: number
  name: string
  provider: ChannelMonitorProvider
  api_mode: ChannelMonitorApiMode
  description: string
  extra_headers: Record<string, string>
  body_override_mode: ChannelMonitorBodyOverrideMode
  body_override?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  associated_monitors: number
}

export type ChannelMonitorTemplateListParams = {
  provider?: ChannelMonitorProvider
  api_mode?: ChannelMonitorApiMode
}

export type ChannelMonitorTemplateListData = {
  items: ChannelMonitorTemplate[]
}

export type ChannelMonitorTemplatePayload = {
  name: string
  provider: ChannelMonitorProvider
  api_mode?: ChannelMonitorApiMode
  description?: string
  extra_headers?: Record<string, string>
  body_override_mode?: ChannelMonitorBodyOverrideMode
  body_override?: Record<string, unknown> | null
}

export type ChannelMonitorTemplateUpdatePayload = Partial<
  Omit<ChannelMonitorTemplatePayload, 'provider'>
>

export type AssociatedMonitorBrief = {
  id: number
  name: string
  provider: ChannelMonitorProvider
  api_mode: ChannelMonitorApiMode
  enabled: boolean
}

export type AssociatedMonitorsData = {
  items: AssociatedMonitorBrief[]
}
