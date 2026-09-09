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
import { api } from '@/lib/api'

export interface SchedulerConfig {
  enabled: boolean
  bootstrap_urls: string
  local_url: string
  token_set: boolean
  mode: 'shadow' | 'enforced' | 'canary'
  canary_percent: number
  canary_salt: string
  shadow_timeout_ms: number
  runtime_prefix: string
  runtime_high_watermark: number
  signing_secret_set: boolean
  catalog_token_set: boolean
  emergency_native_routing: boolean
  emergency_max_duration_seconds: number
  emergency_groups: string
  emergency_models: string
  emergency_local_switch: boolean
  kill_switch: boolean
}

export interface SchedulerMonitor {
  configured: boolean
  url: string
  urls?: string[]
  reachable: boolean
  checked_at: string
  nodes?: Array<{ url: string; reachable: boolean }>
  observability?: {
    status?: string
    catalog?: {
      version?: string
      model?: string
      endpoint_count?: number
      enabled_count?: number
    }
    evaluation?: {
      score_version?: string
      age_seconds?: number
      metric_count?: number
      expired?: boolean
    }
    runtime?: { known_endpoints?: number; stale_endpoints?: number }
    health?: {
      available?: number
      degraded?: number
      exhausted?: number
      error?: number
    }
    endpoints?: SchedulerMonitorEndpoint[]
  }
}

export interface SchedulerMonitorEndpoint {
  endpoint_id: string
  channel_id: number
  key_index: number
  provider?: string
  model?: string
  enabled?: boolean
  health?: string
  runtime_known?: boolean
  rpm_used?: number
  tpm_used?: number
  rpm_capacity?: number
  tpm_capacity?: number
  inflight?: number
  load_ratio?: number
  updated_at?: string
  profiles?: Record<string, { score?: number; gate_tier: number }>
}

export async function getSchedulerConfig() {
  const response = await api.get<{ success: boolean; data: SchedulerConfig }>(
    '/api/scheduler/config'
  )
  return response.data
}

export async function updateSchedulerConfig(
  payload: Partial<SchedulerConfig> & {
    token?: string
    signing_secret?: string
  }
) {
  const response = await api.put<{ success: boolean; data: SchedulerConfig }>(
    '/api/scheduler/config',
    payload
  )
  return response.data
}

export async function getSchedulerMonitor(filters?: { model?: string; endpoint_id?: string; channel_id?: string }) {
  const params = new URLSearchParams()
  Object.entries(filters ?? {}).forEach(([key, value]) => value && params.set(key, value))
  const response = await api.get<{ success: boolean; data: SchedulerMonitor }>(
    `/api/scheduler/monitor${params.toString() ? `?${params.toString()}` : ''}`
  )
  return response.data
}

export async function testSchedulerConnection() {
  const response = await api.post<{ success: boolean; message?: string }>(
    '/api/scheduler/test-connection'
  )
  return response.data
}
