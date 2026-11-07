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

import type { AdminLogStat, OverviewQuotaRow, OverviewUserRow } from './types'

function validateOverviewResponse<
  T extends { success: boolean; data?: unknown },
>(response: T): T {
  if (
    !response ||
    typeof response !== 'object' ||
    typeof response.success !== 'boolean' ||
    (response.success && !('data' in response))
  ) {
    throw new Error('Invalid overview response')
  }
  return response
}

/**
 * Hourly quota data grouped by model. Admin-only (`GET /api/data`).
 * Rows are pre-aggregated by the backend, so this does not scan the logs table.
 */
export async function getAdminQuotaRows(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: OverviewQuotaRow[]
  }>('/api/data', { params })
  return validateOverviewResponse(res.data)
}

/**
 * Hourly quota data grouped by user. Admin-only (`GET /api/data/users`).
 */
export async function getAdminUserQuotaRows(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: OverviewUserRow[]
  }>('/api/data/users', { params })
  return validateOverviewResponse(res.data)
}

/**
 * Consumed quota across all logs. Admin-only (`GET /api/log/stat`).
 * Only used for the all-time revenue figure, with a longer cache window.
 */
export async function getAdminLogStat(params: {
  start_timestamp?: number
  end_timestamp?: number
}) {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: AdminLogStat
  }>('/api/log/stat', { params })
  return validateOverviewResponse(res.data)
}

/**
 * Total registered users. Requesting a single row keeps the payload small;
 * only `data.total` is consumed.
 */
export async function getAdminRegisteredUserTotal() {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: { total?: number }
  }>('/api/user/', { params: { p: 1, page_size: 1 } })
  return validateOverviewResponse(res.data)
}
