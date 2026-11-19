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
export type ThirdPartySiteType = 'newapi'

export interface ThirdPartySite {
  id: number
  name: string
  type: string
  base_url: string
  remote_user_id: number
  receivable_discount: number
  created_time: number
  updated_time: number
}

export interface ThirdPartySitePayload {
  name: string
  type: ThirdPartySiteType
  base_url: string
  remote_user_id: number
  receivable_discount: number
  api_key?: string
}

export interface ThirdPartySitesPage {
  items: ThirdPartySite[]
  total: number
  page: number
  page_size: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  message_key?: string
  field?: string
  data?: T
}

export type ThirdPartySitesDialogType = 'create' | 'update' | 'delete'
