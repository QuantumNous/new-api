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
import type { PlanRecord } from '@/features/subscriptions/types'
import { api } from '@/lib/api'

import type {
  FlowQuotaDataItem,
  QuotaDataItem,
  RealtimeDimensions,
  RealtimeSnapshot,
  RealtimeUsersResponse,
  UptimeGroupResult,
  UsageStatsResult,
} from './types'

export interface PackageComparisonStat {
  plan_id: number
  plan_title: string
  plan_price: number
  currency: string
  plan_quota: number
  requests: number
  success_requests: number
  error_requests: number
  success_rate: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  quota: number
  average_latency_ms: number
  channel_hit_rate: number
}

export async function getAdminPlans(): Promise<{
  success: boolean
  data?: PlanRecord[]
}> {
  const res = await api.get<{ success: boolean; data?: PlanRecord[] }>(
    '/api/subscription/admin/plans'
  )
  return res.data
}

export async function getPackageComparison(params: {
  plan_ids: number[]
  start_timestamp: number
  end_timestamp: number
  model_name?: string
  group?: string
}) {
  const res = await api.get<{
    success: boolean
    data?: { plans: PackageComparisonStat[] }
  }>('/api/admin/analytics/package-comparison', {
    params: { ...params, plan_ids: params.plan_ids.join(',') },
  })
  return res.data
}

// ============================================================================
// Dashboard APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Quota & Usage Data
// ----------------------------------------------------------------------------

// Get user quota data within a time range
// Admin users get all users' data by default.
export async function getUserQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data' : '/api/data/self'
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    endpoint,
    { params }
  )
  return res.data
}

// Distinct key names / models that have consumption rows in the window. Used
// by the consumption chart's inline quick filters.
export async function getQuotaDataDimensions(
  params?: { start_timestamp?: number; end_timestamp?: number },
  isAdmin = false
): Promise<{
  success: boolean
  data?: { keys: string[]; models: string[] }
}> {
  const endpoint = isAdmin
    ? '/api/data/dimensions'
    : '/api/data/self/dimensions'
  const res = await api.get<{
    success: boolean
    data?: { keys: string[]; models: string[] }
    message?: string
  }>(endpoint, { params })
  return res.data
}

// ----------------------------------------------------------------------------
// Realtime Throughput
// ----------------------------------------------------------------------------

// Get the calling user's own realtime throughput. The backend derives the user
// from the session, so there is deliberately no user id parameter here.
//
// tokenId / model narrow the result to one key and/or model. They can only
// narrow: the filter is applied inside the caller's own counters server-side,
// so passing another account's key returns nothing rather than its traffic.
export async function getSelfRealtimeMetrics(filter?: {
  tokenId?: number
  model?: string
}) {
  const params: Record<string, string | number> = {}
  if (filter?.tokenId) params.token_id = filter.tokenId
  if (filter?.model) params.model = filter.model

  const res = await api.get<{ success: boolean; data: RealtimeSnapshot }>(
    '/api/data/realtime/self',
    { params }
  )
  return res.data
}

// List the keys and models the calling user currently has live traffic for.
// Only active combinations are returned, since selecting an idle key could
// only ever produce an empty chart.
export async function getSelfRealtimeDimensions(windowSeconds = 3600) {
  const res = await api.get<{ success: boolean; data: RealtimeDimensions }>(
    '/api/data/realtime/self/dimensions',
    { params: { window_seconds: windowSeconds } }
  )
  return res.data
}

// Get the calling user's historical usage, including spend, over an arbitrary
// range. This reads the hourly rollup rather than the in-memory rings, so it
// can answer for a month but cannot resolve finer than an hour.
export async function getSelfUsageStats(params: {
  startTimestamp?: number
  endTimestamp?: number
  bucketSeconds?: number
  tokenId?: number
  model?: string
}) {
  const query: Record<string, string | number> = {}
  if (params.startTimestamp) query.start_timestamp = params.startTimestamp
  if (params.endTimestamp) query.end_timestamp = params.endTimestamp
  if (params.bucketSeconds) query.bucket_seconds = params.bucketSeconds
  if (params.tokenId) query.token_id = params.tokenId
  if (params.model) query.model = params.model

  const res = await api.get<{ success: boolean; data: UsageStatsResult }>(
    '/api/data/usage/self',
    { params: query }
  )
  return res.data
}

// Get per-user realtime throughput. Admin only — the route is AdminAuth gated
// on the server, so a non-admin role would get 403 rather than other users'
// numbers.
export async function getRealtimeMetricsUsers(windowSeconds = 60) {
  const res = await api.get<{ success: boolean; data: RealtimeUsersResponse }>(
    '/api/data/realtime/users',
    { params: { window_seconds: windowSeconds } }
  )
  return res.data
}

// Get one specific user's realtime throughput. Admin only.
export async function getRealtimeMetricsByUser(userId: number) {
  const res = await api.get<{ success: boolean; data: RealtimeSnapshot }>(
    `/api/data/realtime/users/${userId}`
  )
  return res.data
}

// ----------------------------------------------------------------------------
// System Monitoring
// ----------------------------------------------------------------------------

export async function getUserQuotaDataByUsers(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/users',
    { params }
  )
  return res.data
}

export async function getFlowQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data/flow' : '/api/data/flow/self'
  const res = await api.get<{
    success: boolean
    data?: FlowQuotaDataItem[]
    message?: string
  }>(endpoint, { params })
  return res.data
}

// Get uptime monitoring status for all services
export async function getUptimeStatus() {
  const res = await api.get<{ success: boolean; data: UptimeGroupResult[] }>(
    '/api/uptime/status'
  )
  return res.data
}
