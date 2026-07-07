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

export interface OpsNameCount {
  name: string
  count: number
}

export interface OpsCampaignRow extends OpsFunnelRow {
  keywords: string[] | null
  languages: string[] | null
  landing_pages: OpsNameCount[] | null
  match_types: OpsNameCount[] | null
  trend: number[] | null
}

export interface OpsKeywordRow extends OpsFunnelRow {
  campaigns: string[] | null
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
  registered_at: number
  campaign: string
  keyword: string
  lng: string
  landing: string
  signup_method: string
  currencies: string[] | null
  last_ip: string
  ip_country: string
  balance_usd: number
  consumed_usd: number
  requests: number
  last_active_at: number
  top_models: string[] | null
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
  keyword_funnel: OpsKeywordRow[] | null
  payment_weekly: OpsPaymentRow[]
  dau: OpsDauRow[]
  total_paid_users: number
  total_paid_usd: number
  top_payers: OpsPayerRow[] | null
}

export type OpsStripePersonStatus = 'paid' | 'failed' | 'no_action' | 'setup'

export interface OpsStripePersonRow {
  user_id: number
  email: string
  display_name: string
  billing_names: string[] | null
  locales: string[] | null
  landing: string
  referrer: string
  registered_at: number
  balance_usd: number
  last_ip: string
  ip_country: string
  campaign: string
  keyword: string
  lng: string
  signup_method: string
  requests: number
  consumed_usd: number
  first_at: number
  last_at: number
  sessions: number
  completed: number
  attempts: number
  succeeded: number
  amounts: OpsNameCount[] | null
  methods: string[] | null
  card_country: string[] | null
  card_brands: string[] | null
  billing_cc: string[] | null
  fail_reasons: OpsNameCount[] | null
  status: OpsStripePersonStatus
}

export interface OpsStripeReport {
  generated_at: number
  days: number
  sessions_created: number
  sessions_completed: number
  sessions_expired: number
  charges_succeeded: number
  charges_failed: number
  charges_blocked: number
  persons: OpsStripePersonRow[] | null
  unmatched_sessions: number
  capped: boolean
}
