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
  ChannelQuotaDataItem,
  FlowQuotaDataItem,
  GroupQuotaDataItem,
  QuotaDataItem,
  UptimeGroupResult,
} from './types'

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

// ----------------------------------------------------------------------------
// System Monitoring
// ----------------------------------------------------------------------------

export async function getUserQuotaDataByUsers(params: {
  start_timestamp: number
  end_timestamp: number
  username?: string
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

// Admin-only channel-level hourly aggregation, used by the cache rate chart.
// The optional username mirrors the dashboard's user filter so the channel
// dimension stays consistent with the model dimension's data scope.
export async function getChannelQuotaDates(params: {
  start_timestamp: number
  end_timestamp: number
  username?: string
}) {
  const res = await api.get<{
    success: boolean
    data?: ChannelQuotaDataItem[]
    message?: string
  }>('/api/data/channel', { params })
  return res.data
}

// Group-level hourly aggregation for the cache rate chart's group dimension.
// Admins get every user's rows (optionally filtered by the dashboard's user
// filter); regular users only get their own rows, so the username filter does
// not apply to them.
export async function getGroupQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data/group' : '/api/data/group/self'
  const res = await api.get<{
    success: boolean
    data?: GroupQuotaDataItem[]
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
