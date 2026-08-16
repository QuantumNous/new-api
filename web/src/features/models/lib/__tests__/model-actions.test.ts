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
import { afterEach, describe, test } from 'node:test'

import type { QueryClient } from '@tanstack/react-query'

const { api } = await import('@/lib/api')
const {
  handleEnableModel,
  handleBatchEnableModels,
  handleBatchDisableModelsNoChannels,
  handleBatchEnableModelsWithChannels,
} = await import('../model-actions')

type ApiPost = (url: string, data?: unknown) => Promise<{ data: unknown }>
type ApiPut = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = {
  post: ApiPost
  put: ApiPut
}

const apiClient = api as unknown as MockableApi
const originalPost = apiClient.post
const originalPut = apiClient.put

afterEach(() => {
  apiClient.post = originalPost
  apiClient.put = originalPut
})

describe('model status actions', () => {
  test('does not report a single enable as successful when reconciliation disables it again', async () => {
    let callbackCalled = false
    apiClient.put = async (url, data) => {
      assert.equal(url, '/api/models/?status_only=true')
      assert.deepEqual(data, { id: 7, status: 1 })
      return {
        data: { success: true, data: { id: 7, status: 0 } },
      }
    }

    await handleEnableModel(7, undefined, () => {
      callbackCalled = true
    })

    assert.equal(callbackCalled, false)
  })

  test('sends one request for a batch and reports only final successful updates', async () => {
    let requestCount = 0
    let callbackCalled = false
    apiClient.post = async (url, data) => {
      requestCount++
      assert.equal(url, '/api/models/batch_status')
      assert.deepEqual(data, { ids: [1, 2, 3], status: 1 })
      return {
        data: {
          success: true,
          data: { updated: 2, failed_ids: [3] },
        },
      }
    }

    await handleBatchEnableModels([1, 2, 3], undefined, () => {
      callbackCalled = true
    })

    assert.equal(requestCount, 1)
    assert.equal(callbackCalled, true)
  })

  test('refreshes final model state when every requested enable is reconciled back', async () => {
    const invalidatedKeys: unknown[] = []
    apiClient.post = async () => ({
      data: {
        success: true,
        data: { updated: 0, failed_ids: [1, 2] },
      },
    })
    const queryClient = {
      invalidateQueries: async (options: { queryKey: unknown }) => {
        invalidatedKeys.push(options.queryKey)
      },
    } as unknown as QueryClient

    await handleBatchEnableModels([1, 2], queryClient)

    assert.deepEqual(invalidatedKeys, [['models']])
  })
})

describe('batch channel availability model actions', () => {
  test('returns false and skips success callback after a business failure', async () => {
    let callbackCalled = false
    apiClient.post = async (url) => {
      assert.equal(url, '/api/models/batch_disable_no_channels')
      return {
        data: { success: false, message: 'batch rejected' },
      }
    }

    const succeeded = await handleBatchDisableModelsNoChannels(
      undefined,
      () => {
        callbackCalled = true
      }
    )

    assert.equal(succeeded, false)
    assert.equal(callbackCalled, false)
  })

  test('returns false after a request failure', async () => {
    apiClient.post = async (url) => {
      assert.equal(url, '/api/models/batch_enable_with_channels')
      throw new Error('request failed')
    }

    const succeeded = await handleBatchEnableModelsWithChannels()

    assert.equal(succeeded, false)
  })

  test('returns true and reports the affected count after success', async () => {
    let disabledCount = -1
    apiClient.post = async (url) => {
      assert.equal(url, '/api/models/batch_disable_no_channels')
      return {
        data: {
          success: true,
          data: { disabled: 3 },
        },
      }
    }

    const succeeded = await handleBatchDisableModelsNoChannels(
      undefined,
      (count) => {
        disabledCount = count
      }
    )

    assert.equal(succeeded, true)
    assert.equal(disabledCount, 3)
  })
})
