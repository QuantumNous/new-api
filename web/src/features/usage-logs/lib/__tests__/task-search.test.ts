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
import { expect, test, vi } from 'vitest'

import { getUserTaskLogs, getUserLogs } from '../../api'
import { fetchLogsByCategory } from '../utils'

vi.mock('../../api', () => ({
  getUserTaskLogs: vi.fn(),
  getUserLogs: vi.fn(),
}))

test('exact task ID search without dates finds historical tasks', async () => {
  await fetchLogsByCategory({
    logCategory: 'task',
    isAdmin: false,
    page: 1,
    pageSize: 20,
    searchParams: { filter: 'task-public' },
    columnFilters: [],
  })

  expect(getUserTaskLogs).toHaveBeenCalledWith({
    p: 1,
    page_size: 20,
    task_id: 'task-public',
  })
})

test('explicit date range is preserved when searching for a task ID', async () => {
  await fetchLogsByCategory({
    logCategory: 'task',
    isAdmin: false,
    page: 1,
    pageSize: 20,
    searchParams: {
      filter: 'task-public',
      startTime: 1_700_000_000_000,
      endTime: 1_700_086_400_000,
    },
    columnFilters: [],
  })

  expect(getUserTaskLogs).toHaveBeenCalledWith({
    p: 1,
    page_size: 20,
    task_id: 'task-public',
    start_timestamp: 1_700_000_000,
    end_timestamp: 1_700_086_400,
  })
})

test('ordinary usage log search still uses the default date range', async () => {
  await fetchLogsByCategory({
    logCategory: 'common',
    isAdmin: false,
    page: 1,
    pageSize: 20,
    searchParams: {},
    columnFilters: [],
  })

  expect(getUserLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      start_timestamp: expect.any(Number),
      end_timestamp: expect.any(Number),
    })
  )
})

test('task list without an ID still uses the default date range', async () => {
  await fetchLogsByCategory({
    logCategory: 'task',
    isAdmin: false,
    page: 1,
    pageSize: 20,
    searchParams: {},
    columnFilters: [],
  })

  expect(getUserTaskLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      start_timestamp: expect.any(Number),
      end_timestamp: expect.any(Number),
    })
  )
})
