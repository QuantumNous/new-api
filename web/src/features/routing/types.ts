/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/

export type RoutingMode =
  | 'balanced'
  | 'price'
  | 'latency'
  | 'throughput'
  | 'quality'

export interface RoutingPreference {
  mode: RoutingMode
  allow_fallbacks?: boolean
  max_attempts?: number
  max_price?: number
  min_quality_score?: number
  provider_order?: string[]
  only_providers?: string[]
  ignore_providers?: string[]
  preferred_regions?: string[]
  data_policy?: string
  preference_version?: string
}

export interface GlobalRoutingFormValues {
  mode: RoutingMode
  allow_fallbacks: boolean
  max_attempts: number
  max_price: number
  min_quality_score: number
  preference_version: string
}

export interface RoutingPreferencesResponse {
  success: boolean
  message?: string
  data?: {
    routing_preferences?: Record<string, RoutingPreference>
  }
}
