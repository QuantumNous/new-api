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

let queryClient: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  queryClient = new QueryClient()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function answer(data: Record<string, unknown>) {
  return vi.spyOn(api, 'get').mockResolvedValue({ data })
}

test('a started update says it runs in the background and reloads the list later', async () => {
  answer({
    success: true,
    message: 'Balance update started in the background',
    data: { started: true },
  })
  const success = vi.spyOn(toast, 'success')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const onSuccess = vi.fn()

  await handleUpdateAllBalances(queryClient, onSuccess)

  expect(success).toHaveBeenCalledWith(
    'Balances are updating in the background. The list will refresh on its own.'
  )
  expect(onSuccess).toHaveBeenCalledOnce()
  expect(invalidate).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(10_000)
  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(invalidate).toHaveBeenLastCalledWith({
    queryKey: channelsQueryKeys.lists(),
  })

  await vi.advanceTimersByTimeAsync(50_000)
  expect(invalidate).toHaveBeenCalledTimes(2)
})

test('an older server that only answers success still counts as started', async () => {
  answer({ success: true, message: '' })
  const success = vi.spyOn(toast, 'success')

  await handleUpdateAllBalances(queryClient)

  expect(success).toHaveBeenCalledWith(
    'Balances are updating in the background. The list will refresh on its own.'
  )
})

test('an update already running is reported without starting the reloads', async () => {
  answer({
    success: true,
    message: 'A balance update is already running',
    message_key: 'A balance update is already running',
    data: { started: false },
  })
  const success = vi.spyOn(toast, 'success')
  const info = vi.spyOn(toast, 'info')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const onSuccess = vi.fn()

  await handleUpdateAllBalances(queryClient, onSuccess)
  await vi.advanceTimersByTimeAsync(60_000)

  expect(info).toHaveBeenCalledWith('A balance update is already running')
  expect(success).not.toHaveBeenCalled()
  expect(onSuccess).not.toHaveBeenCalled()
  expect(invalidate).not.toHaveBeenCalled()
})

test('a refused update shows the server message', async () => {
  answer({ success: false, message: 'Balance updates are turned off' })
  const error = vi.spyOn(toast, 'error')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  await handleUpdateAllBalances(queryClient)
  await vi.advanceTimersByTimeAsync(60_000)

  expect(error).toHaveBeenCalledWith('Balance updates are turned off')
  expect(invalidate).not.toHaveBeenCalled()
})
