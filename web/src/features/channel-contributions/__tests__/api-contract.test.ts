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

import { api } from '@/lib/http-client'

import {
  getAdminChannelContributions,
  getChannelContributionRewardTransfers,
  getChannelContributionRewards,
  getChannelContributions,
} from '../api'

type ApiGet = (
  url: string,
  config?: unknown
) => Promise<{ data: { success: boolean; data: unknown } }>

const apiClient = api as unknown as { get: ApiGet }
const originalGet = apiClient.get

afterEach(() => {
  apiClient.get = originalGet
})

describe('channel contribution API contract', () => {
  test('uses the backend p parameter for every paginated endpoint', async () => {
    const calls: Array<{ url: string; config?: unknown }> = []
    apiClient.get = async (url, config) => {
      calls.push({ url, config })
      return { data: { success: true, data: { items: [], total: 0 } } }
    }

    await getChannelContributions({ page: 3, page_size: 20 })
    await getAdminChannelContributions({
      page: 4,
      page_size: 25,
      status: 'pending',
    })
    await getChannelContributionRewards({ page: 5, page_size: 50 })
    await getChannelContributionRewardTransfers({ page: 6, page_size: 10 })

    assert.deepEqual(calls, [
      {
        url: '/api/channel-contributions',
        config: {
          params: { p: 3, page_size: 20, status: undefined },
          disableDuplicate: true,
        },
      },
      {
        url: '/api/channel-contributions/admin',
        config: {
          params: { p: 4, page_size: 25, status: 'pending' },
          disableDuplicate: true,
        },
      },
      {
        url: '/api/channel-contributions/rewards',
        config: {
          params: { p: 5, page_size: 50 },
          disableDuplicate: true,
        },
      },
      {
        url: '/api/channel-contributions/reward-transfers',
        config: {
          params: { p: 6, page_size: 10 },
          disableDuplicate: true,
        },
      },
    ])
  })
})
