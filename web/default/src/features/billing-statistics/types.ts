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
export type BillingStatsGranularity = 'hour' | 'day' | 'week' | 'month'

export interface BillingStatisticsQuery {
  start_timestamp: number
  end_timestamp: number
  granularity: BillingStatsGranularity
  username?: string
  p: number
  page_size: number
}

export interface BillingStatisticsSummary {
  recharge_amount: number
  subscription_amount: number
  total_amount: number
  redundant_amount: number
  consume_quota: number
  consume_amount: number
}

export interface BillingStatisticsRow extends BillingStatisticsSummary {
  bucket_start: number
  bucket_label: string
  user_id: number
  username: string
}

export interface BillingStatisticsUserRow extends BillingStatisticsSummary {
  user_id: number
  username: string
}

export interface BillingStatisticsResult {
  start_timestamp: number
  end_timestamp: number
  granularity: BillingStatsGranularity
  page: number
  page_size: number
  total_pages: number
  user_items_total: number
  summary: BillingStatisticsSummary
  items: BillingStatisticsRow[]
  user_items?: BillingStatisticsUserRow[]
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}
