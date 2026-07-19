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
export type InvitationCodeStatus = 1 | 2 | 3

export type InvitationCode = {
  id: number
  name: string
  code_prefix: string
  status: InvitationCodeStatus
  state?: 'enabled' | 'disabled' | 'used' | 'expired' | string
  created_by: number
  used_user_id: number
  used_username?: string
  created_time: number
  used_time: number
  expired_time: number
}

export type InvitationCodePage = {
  items: InvitationCode[]
  total: number
  page: number
  page_size: number
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

export type InvitationCodeListParams = {
  keyword?: string
  status?: string
  p?: number
  page_size?: number
}

export type CreateInvitationCodesRequest = {
  name: string
  count: number
  expired_time: number
}
