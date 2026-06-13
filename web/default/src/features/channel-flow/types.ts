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

export type PageResponse<T> = {
  page: number
  page_size: number
  total: number
  items: T[]
}

export type ChannelFlowBackend = 'memory' | 'redis'
export type ChannelFlowQueuePolicy = 'fifo'
export type ChannelFlowOnLimit = 'queue' | 'reject' | 'fallback'
export type ChannelFlowRedisFailurePolicy =
  | 'fail_open'
  | 'fail_closed'
  | 'local_memory'
export type ChannelFlowMatchMode = 'channel' | 'channel_model'

export type ChannelFlowPool = {
  id: number
  pool_key: string
  name: string
  description: string
  enabled: boolean
  backend: ChannelFlowBackend
  max_inflight: number
  max_queue_size: number
  max_queue_per_user: number
  queue_timeout_ms: number
  queue_policy: ChannelFlowQueuePolicy
  on_limit: ChannelFlowOnLimit
  redis_failure_policy: ChannelFlowRedisFailurePolicy
  max_context_tokens: number
  max_context_chars: number
  max_processing_ms: number
  lease_ms: number
  renew_interval_ms: number
  config_version: number
  created_time: number
  updated_time: number
}

export type ChannelFlowPoolPayload = Omit<
  ChannelFlowPool,
  'pool_key' | 'config_version' | 'created_time' | 'updated_time'
>

export type ChannelFlowPoolBinding = {
  id: number
  pool_id: number
  channel_id: number
  upstream_model: string
  match_mode: ChannelFlowMatchMode
  enabled: boolean
  created_time: number
  updated_time: number
}

export type ChannelFlowBindingPayload = {
  channel_id: number
  upstream_model: string
  match_mode: ChannelFlowMatchMode
  enabled: boolean
}

export type ChannelFlowPoolStatus = {
  pool_key: string
  name: string
  backend: ChannelFlowBackend
  health: string
  running: number
  max_inflight: number
  queued: number
  max_queue_size: number
  oldest_wait_ms: number
  config_version: number
  lease_renew_failures: number
}

export type FlowTrendPoint = {
  at: string
  running: number
  queued: number
}

