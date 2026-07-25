/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/

export type ModelHealthWindow = 24 | 168 | 720
export type ModelHealthState = 'insufficient' | 'healthy' | 'watch' | 'degraded'

export type ModelHealthMetadata = {
  collection_enabled: boolean
  retention_days: number
  requested_hours: number
  bucket_seconds: number
  window_start: number
  data_cutoff: number
  first_observed_at: number | null
  last_observed_at: number | null
  generated_at: number
  health_policy: {
    minimum_requests: number
    healthy_success_rate_pct: number
    watch_success_rate_pct: number
  }
  data_quality: {
    mode: 'best_effort_persisted'
    completeness_guaranteed: false
    caveats: Array<{ code: string; description: string }>
  }
}

export type ModelHealthModel = {
  model_name: string
  health: ModelHealthState
  request_count: number
  success_count: number
  success_rate: number
  avg_latency_ms: number
  avg_ttft_ms: number | null
  avg_tps: number | null
  first_observed_at: number | null
  last_observed_at: number | null
}

export type ModelHealthFleet = {
  model_count: number
  sufficiently_sampled_models: number
  healthy_models: number
  watch_models: number
  degraded_models: number
  insufficient_models: number
  request_count: number
  success_count: number
  success_rate: number
}

export type ModelHealthOverview = ModelHealthMetadata & {
  fleet: ModelHealthFleet
  models: ModelHealthModel[]
}

export type ModelHealthSeriesPoint = {
  ts: number
  health: ModelHealthState
  request_count: number
  success_count: number
  success_rate: number
  avg_latency_ms: number
  avg_ttft_ms: number | null
  avg_tps: number | null
}

export type ModelHealthGroup = Omit<
  ModelHealthSeriesPoint,
  'ts' | 'success_count'
> & { group: string; success_count: number }

export type ModelHealthDetail = ModelHealthMetadata & {
  model: ModelHealthModel
  series: ModelHealthSeriesPoint[]
  groups: ModelHealthGroup[]
}

export type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

export type ModelHealthFilter = 'all' | ModelHealthState
export type ModelHealthSortKey =
  | 'health'
  | 'model_name'
  | 'request_count'
  | 'success_rate'
  | 'avg_ttft_ms'
  | 'avg_latency_ms'
  | 'avg_tps'
export type SortDirection = 'asc' | 'desc'
