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
import { afterEach, test } from 'node:test'

import type { QueryClient } from '@tanstack/react-query'

const { api } = await import('@/lib/api')
const { handleBatchEnable } = await import('../channel-actions')

type ApiPost = (url: string, data?: unknown) => Promise<{ data: unknown }>
const apiClient = api as unknown as { post: ApiPost }
const originalPost = apiClient.post

afterEach(() => {
  apiClient.post = originalPost
})

test('refreshes channels after a partially successful batch status update', async () => {
  const invalidatedKeys: unknown[] = []
  let callbackCalled = false
  apiClient.post = async (url, data) => {
    assert.equal(url, '/api/channel/status/batch')
    assert.deepEqual(data, { ids: [11, 12], status: 1 })
    return {
      data: {
        success: false,
        message: 'failed to update channel status for ids: [12]',
        data: { changed: 1, failed_ids: [12] },
      },
    }
  }
  const queryClient = {
    invalidateQueries: async (options: { queryKey: unknown }) => {
      invalidatedKeys.push(options.queryKey)
    },
  } as unknown as QueryClient

  await handleBatchEnable([11, 12], queryClient, () => {
    callbackCalled = true
  })

  assert.deepEqual(invalidatedKeys, [['channels'], ['models']])
  assert.equal(callbackCalled, true)
})
