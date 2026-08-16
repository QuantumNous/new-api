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
import { afterEach, assert, describe, test } from 'vitest'

import { api } from '@/lib/http-client'

import { createChannel, getChannels } from '../api'
import type { AddChannelRequest } from '../types'

type ApiGet = (
  url: string,
  config?: unknown
) => Promise<{ data: { success: boolean; data: unknown } }>

type ApiPost = (
  url: string,
  data?: unknown,
  config?: unknown
) => Promise<{ data: { success: boolean } }>

const apiClient = api as unknown as { get: ApiGet; post: ApiPost }
const originalGet = apiClient.get
const originalPost = apiClient.post

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
})

describe('channel API contract', () => {
  test('uses the registered collection route for list and create requests', async () => {
    const calls: Array<{ method: string; url: string }> = []
    apiClient.get = async (url) => {
      calls.push({ method: 'GET', url })
      return { data: { success: true, data: { items: [], total: 0 } } }
    }
    apiClient.post = async (url) => {
      calls.push({ method: 'POST', url })
      return { data: { success: true } }
    }

    await getChannels()
    await createChannel({} as AddChannelRequest)

    assert.deepEqual(calls, [
      { method: 'GET', url: '/api/channel/' },
      { method: 'POST', url: '/api/channel/' },
    ])
  })
})
