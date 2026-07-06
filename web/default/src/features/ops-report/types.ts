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

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

export interface OpsFunnelRow {
  key: string
  registrations: number
  real_browse: number
  manual_keys: number
  key_users: number
  pay_intent: number
  paid: number
  paid_usd: number
}

export interface OpsCampaignRow extends OpsFunnelRow {
  keywords: string[] | null
  languages: string[] | null
  landing_paths: string[] | null
}

export interface OpsDauRow {
  date: string
  active_users: number
  requests: number
  quota_usd: number
}

export interface OpsPayerRow {
  user_id: number
  username: string
  display_name: string
  email: string
  paid_usd: number
  orders: number
  first_paid_at: number
}

export interface OpsPaymentRow {
  key: string
  intent: number
  unpaid: number
  first: number
  first_usd: number
  repeat: number
  repeat_usd: number
}

export interface OpsReportData {
  generated_at: number
  days: number
  daily: OpsFunnelRow[]
  weekly_funnel: OpsFunnelRow[]
  campaign_funnel: OpsCampaignRow[]
  payment_weekly: OpsPaymentRow[]
  dau: OpsDauRow[]
  total_paid_users: number
  total_paid_usd: number
  top_payers: OpsPayerRow[] | null
}
