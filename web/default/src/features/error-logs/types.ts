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
export type ErrorCategory =
  | 'auth'
  | 'rate_limit'
  | 'channel'
  | 'validation'
  | 'quota'
  | 'upstream'
  | 'other'

export interface ErrorLogOtherData {
  error_category?: string
  error_type?: string
  error_code?: string | number
  status_code?: number
  request_path?: string
  admin_info?: {
    use_channel?: number[]
    is_multi_key?: boolean
    multi_key_index?: number
  }
}

export interface ErrorLog {
  id: number
  user_id: number
  created_at: number
  type: number
  content: string
  username: string
  token_name: string
  model_name: string
  quota: number
  prompt_tokens: number
  completion_tokens: number
  use_time: number
  is_stream: boolean
  channel: number
  channel_name?: string | null
  token_id: number
  group: string
  ip: string
  other: string
  request_id: string
  upstream_request_id: string
}

export interface ErrorLogFilters {
  startTime?: Date
  endTime?: Date
  errorCategory?: ErrorCategory | ''
  username?: string
  model?: string
  channel?: string
  token?: string
  requestId?: string
  keyword?: string
}

export interface GetErrorLogsParams {
  p?: number
  page_size?: number
  start_timestamp?: number
  end_timestamp?: number
  model_name?: string
  username?: string
  token_name?: string
  channel?: number
  user_id?: number
  request_id?: string
  keyword?: string
  error_category?: string
}

export interface GetErrorLogsResponse {
  success: boolean
  message?: string
  data?: {
    items: ErrorLog[]
    total: number
    page: number
    page_size: number
  }
}
