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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import type { ModelPerfBadgeData } from '../components/model-perf-badge'
import { buildMockBadgeData } from '../lib/mock-badge'
import { normalizeModelName } from '../lib/model-name'
import type { PricingModel } from '../types'

export interface UsePerfBadgeMapOptions {
  models: PricingModel[]
  /** When true, only real probe/relay samples — no mock fill. */
  liveMetricsOnly?: boolean
  hours?: number
}

/**
 * Shared perf lookup for card grid and table view.
 * Keys are case-folded so pricing casings still hit real rows.
 */
export function usePerfBadgeMap(options: UsePerfBadgeMapOptions) {
  const liveMetricsOnly = options.liveMetricsOnly === true
  const hours = options.hours ?? 24

  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', hours],
    queryFn: () => getPerfMetricsSummary(hours),
    staleTime: 60 * 1000,
    retry: false,
  })

  const perfMap = useMemo(() => {
    const map = new Map<string, ModelPerfBadgeData>()
    for (const model of perfQuery.data?.data?.models ?? []) {
      const key = normalizeModelName(model.model_name)
      if (!key) continue
      const existing = map.get(key)
      if (!existing) {
        map.set(key, model)
        continue
      }
      // Prefer the heavier sample when summary returns case variants.
      const existingCount =
        (existing.recent_success_rates?.length ?? 0) +
        (existing.avg_latency_ms > 0 ? 1 : 0)
      const nextCount =
        (model.recent_success_rates?.length ?? 0) +
        (model.avg_latency_ms > 0 ? 1 : 0)
      if (nextCount >= existingCount) {
        map.set(key, model)
      }
    }
    // Cold-start mock fill — skip when live-only mode is on.
    if (!liveMetricsOnly) {
      for (const model of options.models) {
        const key = normalizeModelName(model.model_name)
        if (key && !map.has(key)) {
          map.set(key, buildMockBadgeData(model.model_name || key))
        }
      }
    }
    return map
  }, [perfQuery.data, options.models, liveMetricsOnly])

  return {
    perfMap,
    isLoading: perfQuery.isLoading,
    isError: perfQuery.isError,
  }
}
