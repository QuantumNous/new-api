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
import type { ApiResponse, BillingDailyRow, BillingSummaryFilters } from './types'

export async function getBillingSummary(
  filters: BillingSummaryFilters
): Promise<ApiResponse<BillingDailyRow[]>> {
  const params = new URLSearchParams()
  if (filters.startTime) {
    params.set(
      'start_timestamp',
      String(Math.floor(filters.startTime.getTime() / 1000))
    )
  }
  if (filters.endTime) {
    params.set(
      'end_timestamp',
      String(Math.floor(filters.endTime.getTime() / 1000))
    )
  }
  if (filters.model) params.set('model_name', filters.model)
  if (filters.token) params.set('token_name', filters.token)
  if (filters.username) params.set('username', filters.username)
  if (filters.email) params.set('email', filters.email)
  if (filters.channel) params.set('channel', filters.channel)

  const res = await api.get(`/api/billing-summary/?${params.toString()}`)
  return res.data
}
