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
export type InvitationStatus =
  | 'pending'
  | 'granted'
  | 'blocked'
  | 'locked'
  | 'revoked'

export type InvitationRewardMode = 'topup' | 'subscription'

export const INVITATION_PAGE_SIZE = 10

export type InvitationReason =
  | ''
  | 'inviter_limit_reached'
  | 'inviter_missing'
  | 'unavailable'
  | 'refunded'
  | 'disputed'

export interface InvitationRecord {
  id: number
  masked_identity: string
  registered_at: number
  status: InvitationStatus
  granted_at: number
  reward_usd: number
  reason: InvitationReason
  unlock_at: number
}

export interface InvitationSummary {
  reward_mode: InvitationRewardMode
  first_sub_discount_usd: number
  unlock_delay_days: number
  inviter_reward_usd: number
  invitee_reward_usd: number
  inviter_reward_max_count: number
  history_usd: number
  pending_reward_usd: number
  locked_reward_usd: number
  granted_count: number
  pending_count: number
}

export interface InvitationPageData {
  summary: InvitationSummary
  items: InvitationRecord[]
  page: number
  page_size: number
  total: number
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}

export type InvitationPageResponse = ApiResponse<InvitationPageData>
export type AffiliateCodeResponse = ApiResponse<string>
