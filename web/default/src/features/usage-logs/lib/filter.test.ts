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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  buildSearchParams,
  getDisplayTimeRange,
  getTimeRangeFilters,
} from './filter'
import { buildApiParams } from './utils'

describe('usage log time range filters', () => {
  test('keeps the implicit default range dynamic across days', () => {
    const filters = getTimeRangeFilters()
    const firstDay = getDisplayTimeRange(
      filters,
      new Date(2026, 6, 14, 21, 59, 31)
    )
    const nextDay = getDisplayTimeRange(
      filters,
      new Date(2026, 6, 15, 8, 30, 0)
    )
    const search = buildSearchParams({ ...filters, model: 'gpt-5' }, 'common')

    assert.equal(firstDay.start?.getTime(), new Date(2026, 6, 14).getTime())
    assert.equal(
      firstDay.end?.getTime(),
      new Date(2026, 6, 14, 22, 59, 31).getTime()
    )
    assert.equal(nextDay.start?.getTime(), new Date(2026, 6, 15).getTime())
    assert.equal(
      nextDay.end?.getTime(),
      new Date(2026, 6, 15, 9, 30, 0).getTime()
    )
    assert.deepEqual(search, { model: 'gpt-5' })
  })

  test('preserves an explicit historical range in the URL', () => {
    const startTime = new Date(2026, 6, 10, 0, 0, 0).getTime()
    const endTime = new Date(2026, 6, 10, 23, 59, 59).getTime()
    const filters = getTimeRangeFilters(startTime, endTime)
    const display = getDisplayTimeRange(
      filters,
      new Date(2026, 6, 15, 8, 30, 0)
    )
    const search = buildSearchParams({ ...filters, taskId: 'task-123' }, 'task')

    assert.equal(display.start?.getTime(), startTime)
    assert.equal(display.end?.getTime(), endTime)
    assert.deepEqual(search, {
      startTime,
      endTime,
      filter: 'task-123',
    })
  })

  test('keeps a single explicit boundary without filling the other side', () => {
    const filters = getTimeRangeFilters(0)
    const display = getDisplayTimeRange(filters)
    const apiParams = buildApiParams({
      page: 1,
      pageSize: 20,
      searchParams: { startTime: 0 },
      isAdmin: false,
    })

    assert.equal(display.start?.getTime(), 0)
    assert.equal(display.end, undefined)
    assert.deepEqual(buildSearchParams(filters, 'common'), { startTime: 0 })
    assert.equal(apiParams.start_timestamp, 0)
    assert.equal(apiParams.end_timestamp, undefined)
  })
})
