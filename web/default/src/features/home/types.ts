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
export interface HomePageContentResponse {
  success: boolean
  message?: string
  data?: string
}

export interface HomePageContentResult {
  content: string
  isLoaded: boolean
  isUrl: boolean
}

export type HomeStatsVendor = {
  name: string
  icon: string
}

export type HomeStatsModel = {
  model_name: string
  vendor: string
  vendor_icon: string
  total_tokens: number
  share: number
}

export type HomeStatsPoint = {
  ts: number
  label: string
  tokens: number
}

export type HomeStats = {
  period_days: number
  available_models: number
  active_vendors: number
  endpoint_types: number
  request_count: number | null
  total_tokens: number
  success_rate: number | null
  avg_latency_ms: number | null
  vendors: HomeStatsVendor[]
  top_models: HomeStatsModel[]
  trend: HomeStatsPoint[]
  updated_at: number
}

export type HomeStatsResponse = {
  success: boolean
  message?: string
  data: HomeStats
}
