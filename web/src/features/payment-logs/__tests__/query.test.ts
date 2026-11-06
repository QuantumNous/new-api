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
import { describe, expect, it } from 'vitest'

import { buildPaymentLogQuery } from '../lib/query'

describe('buildPaymentLogQuery', () => {
  it('omits blank filters while keeping pagination', () => {
    const params = buildPaymentLogQuery({
      page: 2,
      pageSize: 20,
      keyword: '   ',
      status: '',
      provider: '',
      fromDate: '',
      toDate: '',
    })

    expect(params).toEqual({ p: 2, page_size: 20 })
  })

  it('trims the keyword and forwards the selected filters', () => {
    const params = buildPaymentLogQuery({
      page: 1,
      pageSize: 50,
      keyword: '  USR123  ',
      status: 'pending',
      provider: 'stripe',
    })

    expect(params).toEqual({
      p: 1,
      page_size: 50,
      keyword: 'USR123',
      status: 'pending',
      payment_provider: 'stripe',
    })
  })

  it('converts a local date range to inclusive Unix seconds', () => {
    const params = buildPaymentLogQuery({
      page: 1,
      pageSize: 20,
      fromDate: '2026-02-03',
      toDate: '2026-02-04',
    })

    expect(params.start_time).toBe(
      Math.floor(new Date(2026, 1, 3, 0, 0, 0).getTime() / 1000)
    )
    expect(params.end_time).toBe(
      Math.floor(new Date(2026, 1, 4, 23, 59, 59).getTime() / 1000)
    )
  })

  it('ignores malformed dates instead of sending invalid bounds', () => {
    const params = buildPaymentLogQuery({
      page: 1,
      pageSize: 20,
      fromDate: 'not-a-date',
      toDate: '2026-13-40',
    })

    expect(params.start_time).toBeUndefined()
    expect(params.end_time).toBeUndefined()
  })
})
