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
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { channelsQueryKeys, handleUpdateAllBalances } from '../channel-actions'

const TASK_URL = '/api/channel/update_balance/task/systask_1'

let queryClient: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  queryClient = new QueryClient()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/**
 * Answers the update request with `start` and each progress check with the
 * next of `progress`; a progress check past the last one rejects.
 */
function serve(
  start: Record<string, unknown>,
  progress: Record<string, unknown>[] = []
) {
  const checks = [...progress]
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/channel/update_balance') return { data: start }
    if (url === TASK_URL) {
      const next = checks.shift()
      if (next) return { data: next }
    }
    throw new Error(`unexpected request ${url}`)
  })
}

function progressOf(status: string, processed: number, error = '') {
  return {
    success: true,
    data: {
      task_id: 'systask_1',
      status,
      state: {
        total: 3,
        processed,
        progress: Math.floor((processed * 100) / 3),
      },
      error,
    },
  }
}

test('a started update reloads the list as channels are queried and reports the end', async () => {
  const get = serve(
    {
      success: true,
      message: 'Balance update started in the background',
      data: { started: true, task_id: 'systask_1', status: 'pending' },
    },
    [
      progressOf('running', 1),
      progressOf('running', 1),
      progressOf('succeeded', 3),
    ]
  )
  const success = vi.spyOn(toast, 'success')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const onSuccess = vi.fn()

  await handleUpdateAllBalances(queryClient, onSuccess)

  expect(success).toHaveBeenCalledWith(
    'Balances are updating in the background. The list will refresh on its own.'
  )
  expect(onSuccess).toHaveBeenCalledOnce()
  expect(invalidate).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(5_000)
  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(invalidate).toHaveBeenLastCalledWith({
    queryKey: channelsQueryKeys.lists(),
  })

  await vi.advanceTimersByTimeAsync(5_000)
  expect(invalidate).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(5_000)
  expect(invalidate).toHaveBeenCalledTimes(2)
  expect(success).toHaveBeenLastCalledWith('All balances updated')

  await vi.advanceTimersByTimeAsync(30_000)
  expect(get).toHaveBeenCalledTimes(4)
})

test('an update already running is reported and followed until it fails', async () => {
  serve(
    {
      success: true,
      message: 'A balance update is already running',
      message_key: 'A balance update is already running',
      data: { started: false, task_id: 'systask_1', status: 'running' },
    },
    [progressOf('failed', 2, 'context canceled')]
  )
  const info = vi.spyOn(toast, 'info')
  const error = vi.spyOn(toast, 'error')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const onSuccess = vi.fn()

  await handleUpdateAllBalances(queryClient, onSuccess)
  expect(info).toHaveBeenCalledWith('A balance update is already running')
  expect(onSuccess).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(5_000)
  expect(invalidate).toHaveBeenCalledOnce()
  expect(error).toHaveBeenCalledWith('Balance update failed', {
    description: 'context canceled',
  })
})

test('a second click while an update is followed adds no second follower', async () => {
  const get = serve(
    {
      success: true,
      data: { started: false, task_id: 'systask_1', status: 'running' },
    },
    [progressOf('succeeded', 3)]
  )
  const success = vi.spyOn(toast, 'success')

  await handleUpdateAllBalances(queryClient)
  await handleUpdateAllBalances(queryClient)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(get).toHaveBeenCalledTimes(3)
  expect(success).toHaveBeenCalledOnce()
  expect(success).toHaveBeenCalledWith('All balances updated')
})

test('a failed progress check stops following after one last reload', async () => {
  const get = serve({
    success: true,
    data: { started: true, task_id: 'systask_1', status: 'pending' },
  })
  const error = vi.spyOn(toast, 'error')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  await handleUpdateAllBalances(queryClient)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(get).toHaveBeenCalledTimes(2)
  expect(invalidate).toHaveBeenCalledOnce()
  expect(error).not.toHaveBeenCalled()
})

test('a refused update shows the server message and checks no progress', async () => {
  const get = serve({
    success: false,
    message: 'Balance updates are turned off',
  })
  const error = vi.spyOn(toast, 'error')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  await handleUpdateAllBalances(queryClient)
  await vi.advanceTimersByTimeAsync(30_000)

  expect(error).toHaveBeenCalledWith('Balance updates are turned off')
  expect(get).toHaveBeenCalledOnce()
  expect(invalidate).not.toHaveBeenCalled()
})
