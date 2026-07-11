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

export interface BillingSummaryFilters {
  startTime?: Date
  endTime?: Date
  model?: string
  token?: string
  username?: string
  email?: string
  channel?: string
}

// One day's aggregated cost/revenue. Profit and margin are derived in the
// frontend (revenue - cost, (revenue - cost) / cost) — not sent by the
// backend, to avoid a persisted derived value going stale.
export interface BillingDailyRow {
  day: number // unix seconds, floored to the day (UTC)
  cost_usd: number
  revenue_usd: number
  accounting_ok_request_count: number
  accounting_target_request_count: number
}

// Frontend-only row shape: a synthetic "Total" row is prepended to the table
// data (not sent by the backend) so the summed totals render as a real,
// always-first table row rather than a separate UI element.
export interface BillingTableRow extends BillingDailyRow {
  isTotal?: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}
