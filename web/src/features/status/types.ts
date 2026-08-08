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

export type StatusLevel = 'ok' | 'degraded' | 'fail'

export type StatusCardRecent = {
  level: StatusLevel
}

export type StatusCard = {
  id: string
  group: string
  name: string
  provider?: string
  model?: string
  status: 'normal' | 'degraded' | 'error' | 'unknown'
  status_label: string
  latency_ms: number | null
  ping_ms: number | null
  availability_7d: number | null
  available_channels: number
  total_channels: number
  recent: StatusCardRecent[]
  recent_limit: number
  updated_at: number
}

export type StatusCardsPayload = {
  enabled: boolean
  refresh_seconds: number
  updated_at: number
  cards: StatusCard[]
}

export type StatusPageGroupConfig = {
  group: string
  enabled: boolean
  display_name: string
  provider: string
  display_model: string
}

export type StatusPageSettingsPayload = {
  enabled: boolean
  refresh_seconds: number
  degraded_latency_ms: number
  enable_ping_probe: boolean
  ping_probe_timeout_ms: number
  groups: StatusPageGroupConfig[]
  available_groups?: string[]
}
