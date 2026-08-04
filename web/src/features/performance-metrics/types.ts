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
export type PerformanceSeriesPoint = {
  ts: number
  avg_ttft_ms: number
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
}

export type PerformanceGroup = {
  group: string
  avg_ttft_ms: number
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  series: PerformanceSeriesPoint[]
}

export type PerformanceMetricsData = {
  success: boolean
  message?: string
  data: {
    model_name: string
    series_schema?: string
    groups: PerformanceGroup[]
  }
}

export type PerfModelSummary = {
  model_name: string
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  recent_success_rates?: number[]
  request_count?: number
}

export type PerfSummaryAllData = {
  success: boolean
  message?: string
  data: {
    models: PerfModelSummary[]
  }
}

export type AdminPerformanceHealth =
  | 'critical'
  | 'degraded'
  | 'healthy'
  | 'insufficient_samples'
  | 'no_samples'

export type AdminPerformanceTimeRange = {
  start: number
  end: number
}

export type AdminPerformanceMetricValues = {
  request_count: number
  success_count: number
  failure_count: number
  success_rate: number | null
  avg_latency_ms: number | null
  avg_ttft_ms: number | null
  ttft_sample_count: number
  output_tokens: number
  avg_tps: number | null
  active_group_count: number
}

export type AdminPerformanceMetricChanges = {
  request_count_pct: number | null
  success_rate_pp: number | null
  avg_latency_pct: number | null
  avg_ttft_pct: number | null
  avg_tps_pct: number | null
}

export type AdminPerformanceGroup = {
  group: string
  enabled: boolean
  health: AdminPerformanceHealth
  health_reasons: string[]
  metrics: AdminPerformanceMetricValues
  previous_metrics: AdminPerformanceMetricValues
  changes: AdminPerformanceMetricChanges
}

export type AdminPerformanceModel = {
  model_name: string
  enabled: boolean
  health: AdminPerformanceHealth
  health_reasons: string[]
  metrics: AdminPerformanceMetricValues
  previous_metrics: AdminPerformanceMetricValues
  changes: AdminPerformanceMetricChanges
  groups: AdminPerformanceGroup[]
}

export type AdminPerformanceData = {
  metrics_enabled: boolean
  generated_at: number
  bucket_seconds: number
  expected_max_lag_seconds: number
  requested_period: AdminPerformanceTimeRange
  actual_period: AdminPerformanceTimeRange
  previous_period: AdminPerformanceTimeRange
  available_range: {
    oldest_bucket_ts: number | null
    newest_bucket_ts: number | null
  }
  has_complete_buckets: boolean
  models: AdminPerformanceModel[]
}

export type AdminPerformanceResponse = {
  success: boolean
  message?: string
  data: AdminPerformanceData
}
