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

/**
 * Aggregated quota row returned by `GET /api/data` (admin).
 *
 * The backend groups hourly quota_data rows by model, so `quota` and
 * `token_used` are integer sums in quota units, never USD floats.
 */
export interface OverviewQuotaRow {
  model_name?: string
  created_at: number
  count?: number
  quota?: number
  token_used?: number
}

/**
 * Aggregated quota row returned by `GET /api/data/users` (admin),
 * grouped by username and hour.
 */
export interface OverviewUserRow {
  username?: string
  created_at: number
  count?: number
  quota?: number
  token_used?: number
}

/** Response data of `GET /api/log/stat` (admin). */
export interface AdminLogStat {
  quota: number
  rpm: number
  tpm: number
}

/**
 * Real-time usage aggregates of `GET /api/log/live_stat` (admin), computed
 * directly from the logs table for the requested window.
 */
export interface AdminLiveStat {
  quota: number
  requests: number
  tokens: number
  users: number
}

/** Integer usage totals kept in raw quota units / token counts. */
export interface UsageTotals {
  quota: number
  tokens: number
  requests: number
}

/** One day of the revenue trend. `quota` stays an exact integer. */
export interface DailyRevenuePoint {
  day: string
  label: string
  quota: number
}

/** One month of the revenue trend. `quota` stays an exact integer. */
export interface MonthlyRevenuePoint {
  month: number
  year: number
  label: string
  quota: number
}

/** One chart series of the token usage chart. */
export interface TokenSeriesEntry {
  key: string
  model: string
}

/** One hour of token usage, split by series key. */
export interface TokenSeriesPoint {
  label: string
  total: number
  values: Record<string, number>
}

export interface TokenUsageSeries {
  series: TokenSeriesEntry[]
  points: TokenSeriesPoint[]
}

/** Consumption per model, ordered by token usage. */
export interface ModelUsage {
  model: string
  quota: number
  tokens: number
  requests: number
}

/** Distinct active users for one hour in the last 24 hours. */
export interface HourlyActivityPoint {
  label: string
  activeUsers: number
}
