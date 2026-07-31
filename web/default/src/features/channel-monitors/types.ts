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

export type ChannelMonitorStatus = 'success' | 'failed' | 'unknown'

export type ChannelMonitorResult = {
  id: number
  success: boolean
  latency_ms: number
  status_code: number
  error_message?: string
  checked_at: number
}

export type ChannelMonitor = {
  id: number
  name: string
  api_url: string
  test_model: string
  interval_seconds: number
  timeout_seconds: number
  enabled: boolean
  visible: boolean
  has_api_key: boolean
  status: ChannelMonitorStatus
  latest_latency_ms: number | null
  latest_status_code: number | null
  latest_error?: string
  last_checked_at: number | null
  next_check_at: number | null
  raw_availability_7d: number | null
  raw_availability_30d: number | null
  availability_7d: number | null
  availability_30d: number | null
  availability_boost_percent: number
  recent_results: ChannelMonitorResult[]
  created_at: number
  updated_at: number
}

export type GroupStatusMonitor = Pick<
  ChannelMonitor,
  | 'id'
  | 'name'
  | 'api_url'
  | 'test_model'
  | 'interval_seconds'
  | 'status'
  | 'latest_latency_ms'
  | 'last_checked_at'
  | 'next_check_at'
  | 'availability_7d'
  | 'availability_30d'
  | 'recent_results'
> & {
  can_test: boolean
  user_test_available_at: number | null
}

export type ChannelMonitorPayload = {
  name: string
  api_url: string
  api_key: string
  test_model: string
  interval_seconds: number
  timeout_seconds: number
  enabled: boolean
  visible: boolean
  availability_boost_percent: number
}

export type ChannelMonitorRunResponse = {
  result: ChannelMonitorResult
  monitor: ChannelMonitor
}

export type GroupStatusTestResult = {
  success: boolean
  latency_ms: number
  checked_at: number
}

export type GroupStatusTestResponse = {
  result: GroupStatusTestResult
  cooldown_seconds: number
  next_test_at: number
}
