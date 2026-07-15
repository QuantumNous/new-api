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

export type OrganizationRole = 'admin' | 'member'
export const ORGANIZATION_STATUS_ENABLED = 1
export const ORGANIZATION_STATUS_DISABLED = 2
export type OrganizationStatus =
  | typeof ORGANIZATION_STATUS_ENABLED
  | typeof ORGANIZATION_STATUS_DISABLED

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Organization {
  id: number
  name: string
  status: OrganizationStatus
  created_at: number
  updated_at: number
}

export interface OrganizationMember {
  id: number
  organization_id: number
  user_id: number
  role: OrganizationRole
  joined_at: number
  left_at: number
  username?: string
  display_name?: string
  email?: string
}

export interface OrganizationSelf {
  organization: Organization
  member: OrganizationMember
}

export interface OrganizationSummary {
  total_quota: number
  request_count: number
  prompt_tokens: number
  completion_tokens: number
  member_count: number
  active_member_count: number
}

export interface OrganizationUsageRow {
  id?: number
  created_at?: number
  user_id?: number
  username?: string
  model_name?: string
  channel_id?: number
  channel_name?: string
  quota?: number
  prompt_tokens?: number
  completion_tokens?: number
  token_name?: string
  type?: number
  request_time?: number
  is_stream?: boolean
}

export interface OrganizationTrendRow {
  period: string
  request_count: number
  total_quota: number
  prompt_tokens?: number
  completion_tokens?: number
}

export interface OrganizationPricingSnapshot {
  quota_type: number
  model_ratio: number
  model_price: number
  billing_mode?: string
  billing_expr?: string
  owner_by?: string
}

export interface OrganizationDimensionRow {
  user_id?: number
  username?: string
  display_name?: string
  model_name?: string
  channel_id?: number
  channel_name?: string
  request_count: number
  total_quota: number
  prompt_tokens?: number
  completion_tokens?: number
  pricing?: OrganizationPricingSnapshot
}

export interface OrganizationBillingFilterOptions {
  members: OrganizationMember[]
  models: OrganizationDimensionRow[]
  channels: OrganizationDimensionRow[]
}

export interface OrganizationListParams {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
}

export interface OrganizationUsageParams {
  start_timestamp?: number
  end_timestamp?: number
  user_id?: number
  model_name?: string
  channel?: number
  p?: number
  page_size?: number
}

export interface MemberPayload {
  user_id: number
  role: OrganizationRole
}

export interface OrganizationPayload {
  name?: string
  status?: OrganizationStatus
}
