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
import { requireServerSuccess } from '@/lib/server-error-message'

import type {
  ApiResponse,
  UpstreamMetric,
  UpstreamOverview,
  UpstreamPriceEvidence,
  UpstreamRoutingPolicy,
  UpstreamSettings,
} from './types'

export async function getUpstreamOverview() {
  const response = await api.get<ApiResponse<UpstreamOverview>>(
    '/api/upstream-orchestration/overview'
  )
  return requireServerSuccess(response.data).data
}

export async function getUpstreamMetrics() {
  const response = await api.get<ApiResponse<UpstreamMetric[]>>(
    '/api/upstream-orchestration/metrics?limit=500'
  )
  return requireServerSuccess(response.data).data ?? []
}

export async function getUpstreamPrices() {
  const response = await api.get<ApiResponse<UpstreamPriceEvidence[]>>(
    '/api/upstream-orchestration/prices?limit=200'
  )
  return requireServerSuccess(response.data).data ?? []
}

export async function requestUpstreamSync() {
  const response = await api.post<ApiResponse<unknown>>(
    '/api/upstream-orchestration/sync-request'
  )
  return requireServerSuccess(response.data)
}

export async function reconcileUpstreams() {
  const response = await api.post<ApiResponse<unknown>>(
    '/api/upstream-orchestration/reconcile'
  )
  return requireServerSuccess(response.data)
}

export async function createPairingCode() {
  const response = await api.post<
    ApiResponse<{ device_id: string; pairing_code: string; expires_at: number }>
  >('/api/upstream-orchestration/devices/pairing-code', {
    device_name: 'Chrome',
  })
  return requireServerSuccess(response.data).data
}

export async function updateUpstreamRoute(
  routeId: number,
  action: 'probe' | 'pause' | 'resume' | 'detach'
) {
  const response = await api.post<ApiResponse<unknown>>(
    `/api/upstream-orchestration/routes/${routeId}/${action}`,
    {}
  )
  return requireServerSuccess(response.data)
}

export async function updateUpstreamSettings(policy: UpstreamRoutingPolicy) {
  const response = await api.put<ApiResponse<UpstreamSettings>>(
    '/api/upstream-orchestration/settings',
    policy
  )
  return requireServerSuccess(response.data).data
}
