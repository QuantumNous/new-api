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

export type PaymentLogStatus = 'pending' | 'success' | 'failed' | 'expired'

export interface PaymentLogEntry {
  id: number
  user_id: number
  username: string
  user_email: string
  /** Credited amount in system USD units, exactly as stored. */
  amount: number
  /** Paid amount as stored by the gateway, without conversion. */
  money: number
  trade_no: string
  payment_method: string
  payment_provider: string
  create_time: number
  complete_time: number
  status: PaymentLogStatus | string
}

export interface GetPaymentLogsParams {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
  payment_provider?: string
  start_time?: number
  end_time?: number
}

export interface GetPaymentLogsResponse {
  success: boolean
  message?: string
  data?: {
    items: PaymentLogEntry[]
    total: number
    page: number
    page_size: number
  }
}
