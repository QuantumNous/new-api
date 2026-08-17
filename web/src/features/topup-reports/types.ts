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

export interface MezonTopupReportItem {
  transaction_id: number
  tx_hash: string
  user_id: number
  user_name: string
  user_email: string
  amount: number
  complete_time: number
}

export interface MezonTopupReportData {
  year: number
  month: number
  items: MezonTopupReportItem[]
  transaction_count: number
  total_amount: number
}

export interface MezonTopupReportResponse {
  success: boolean
  message?: string
  data?: MezonTopupReportData
}
