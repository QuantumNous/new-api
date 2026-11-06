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
import type { GetPaymentLogsParams } from '../types'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDateBoundary(value: string, endOfDay: boolean) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59)
    : new Date(year, month - 1, day, 0, 0, 0)
  if (Number.isNaN(date.getTime())) return undefined
  // Date rolls impossible values (e.g. month 13) into the next period, so
  // require the parsed parts to round-trip before trusting the bound.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return Math.floor(date.getTime() / 1000)
}

export function buildPaymentLogQuery(input: {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  provider?: string
  fromDate?: string
  toDate?: string
}): GetPaymentLogsParams {
  const params: GetPaymentLogsParams = {
    p: input.page,
    page_size: input.pageSize,
  }

  const keyword = input.keyword?.trim()
  if (keyword) params.keyword = keyword
  if (input.status) params.status = input.status
  if (input.provider) params.payment_provider = input.provider

  const startTime = input.fromDate
    ? parseDateBoundary(input.fromDate, false)
    : undefined
  const endTime = input.toDate
    ? parseDateBoundary(input.toDate, true)
    : undefined
  if (startTime !== undefined) params.start_time = startTime
  if (endTime !== undefined) params.end_time = endTime

  return params
}
