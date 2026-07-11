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

import type {
  MetricsActionRequest,
  ModelRouteMetrics,
  ModelRoutePolicy,
  ResetLearningRequest,
  UpdatePolicyPriorityRequest,
} from './types'

export async function listModelRoutePolicies(params?: {
  requested_model?: string
  channel_id?: number
}): Promise<{ success: boolean; message: string; data: ModelRoutePolicy[] }> {
  const res = await api.get('/api/model_route/policies', { params })
  return res.data
}

export async function updateModelRoutePolicyPriority(
  data: UpdatePolicyPriorityRequest
): Promise<{ success: boolean; message: string }> {
  const res = await api.put('/api/model_route/policies/priority', data)
  return res.data
}

export async function listModelRouteMetrics(params?: {
  channel_id?: number
}): Promise<{ success: boolean; message: string; data: ModelRouteMetrics[] }> {
  const res = await api.get('/api/model_route/metrics', { params })
  return res.data
}

export async function modelRouteMetricsAction(
  data: MetricsActionRequest
): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/api/model_route/metrics/action', data)
  return res.data
}

export async function migrateToModelPriority(): Promise<{
  success: boolean
  message: string
  data: unknown
}> {
  const res = await api.post('/api/model_route/migrate')
  return res.data
}

export async function resetRuntimeLearning(
  data: ResetLearningRequest
): Promise<{ success: boolean; message: string; data?: { reset: number } }> {
  const res = await api.post('/api/model_route/reset-runtime-learning', data)
  return res.data
}

export async function resetAllLearning(
  data: ResetLearningRequest
): Promise<{ success: boolean; message: string; data?: { reset: number } }> {
  const res = await api.post('/api/model_route/reset-all-learning', data)
  return res.data
}
