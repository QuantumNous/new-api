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
import type {
  AdminPerformanceData,
  AdminPerformanceHealth,
  AdminPerformanceMetricChanges,
  AdminPerformanceMetricValues,
} from '../types'

export type AdminPerformanceTableRow = {
  id: string
  kind: 'model' | 'group'
  model_name: string
  group_name?: string
  group_names: string[]
  enabled: boolean
  metrics_enabled: boolean
  health: AdminPerformanceHealth
  health_reasons: string[]
  metrics: AdminPerformanceMetricValues
  previous_metrics: AdminPerformanceMetricValues
  changes: AdminPerformanceMetricChanges
  children?: AdminPerformanceTableRow[]
}

export type AdminPerformanceDisplayState =
  | 'loading'
  | 'error'
  | 'disabled'
  | 'no_complete_buckets'
  | 'empty'
  | 'ready'

export function buildAdminPerformanceRows(
  data?: AdminPerformanceData
): AdminPerformanceTableRow[] {
  if (!data) return []

  return data.models.map((model) => ({
    id: `model:${model.model_name}`,
    kind: 'model',
    model_name: model.model_name,
    group_names: model.groups.map((group) => group.group),
    enabled: model.enabled,
    metrics_enabled: data.metrics_enabled,
    health: model.health,
    health_reasons: model.health_reasons,
    metrics: model.metrics,
    previous_metrics: model.previous_metrics,
    changes: model.changes,
    children: model.groups.map((group) => ({
      id: `model:${model.model_name}:group:${group.group}`,
      kind: 'group',
      model_name: model.model_name,
      group_name: group.group,
      group_names: [group.group],
      enabled: group.enabled,
      metrics_enabled: data.metrics_enabled,
      health: group.health,
      health_reasons: group.health_reasons,
      metrics: group.metrics,
      previous_metrics: group.previous_metrics,
      changes: group.changes,
    })),
  }))
}

export function getAdminPerformanceDisplayState(params: {
  loading: boolean
  error: boolean
  hasData: boolean
  metricsEnabled?: boolean
  hasCompleteBuckets?: boolean
  rowCount: number
}): AdminPerformanceDisplayState {
  if (params.loading && !params.hasData) return 'loading'
  if (params.error && !params.hasData) return 'error'
  if (params.metricsEnabled === false) return 'disabled'
  if (params.hasCompleteBuckets === false) return 'no_complete_buckets'
  if (params.rowCount === 0) return 'empty'
  return 'ready'
}

export function adminPerformanceHealthRank(
  health: AdminPerformanceHealth
): number {
  switch (health) {
    case 'critical':
      return 0
    case 'degraded':
      return 1
    case 'healthy':
      return 2
    case 'insufficient_samples':
      return 3
    default:
      return 4
  }
}
