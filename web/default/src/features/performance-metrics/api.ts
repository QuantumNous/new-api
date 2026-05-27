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
import {
  isCachedPerfMetricsFeatureAvailable,
  isMissingPerfMetricsEndpoint,
  isPerfMetricsEndpointUnavailable,
  markPerfMetricsEndpointUnavailable,
} from './compat'
import type { PerformanceMetricsData, PerfSummaryAllData } from './types'

const emptyPerfSummary: PerfSummaryAllData = {
  success: true,
  data: {
    models: [],
  },
}

function emptyPerfMetrics(modelName: string): PerformanceMetricsData {
  return {
    success: true,
    data: {
      model_name: modelName,
      groups: [],
    },
  }
}

export async function getPerfMetricsSummary(
  hours = 24
): Promise<PerfSummaryAllData> {
  if (
    !isCachedPerfMetricsFeatureAvailable() ||
    isPerfMetricsEndpointUnavailable()
  ) {
    return emptyPerfSummary
  }

  try {
    const res = await api.get<PerfSummaryAllData>('/api/perf-metrics/summary', {
      params: { hours },
      skipErrorHandler: true,
    } as Record<string, unknown>)
    return res.data
  } catch (error: unknown) {
    if (isMissingPerfMetricsEndpoint(error)) {
      markPerfMetricsEndpointUnavailable()
      return emptyPerfSummary
    }
    throw error
  }
}

export async function getPerfMetrics(
  modelName: string,
  hours = 24
): Promise<PerformanceMetricsData> {
  if (
    !isCachedPerfMetricsFeatureAvailable() ||
    isPerfMetricsEndpointUnavailable()
  ) {
    return emptyPerfMetrics(modelName)
  }

  try {
    const res = await api.get<PerformanceMetricsData>('/api/perf-metrics', {
      params: {
        model: modelName,
        hours,
      },
      skipErrorHandler: true,
    } as Record<string, unknown>)
    return res.data
  } catch (error: unknown) {
    if (isMissingPerfMetricsEndpoint(error)) {
      markPerfMetricsEndpointUnavailable()
      return emptyPerfMetrics(modelName)
    }
    throw error
  }
}
