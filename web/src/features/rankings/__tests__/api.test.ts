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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/lib/api'

import { getRankings } from '../api'

const originalAdapter = api.defaults.adapter
let payload: unknown

beforeEach(() => {
  api.defaults.adapter = async (config) => ({
    config,
    data: payload,
    headers: {},
    status: 200,
    statusText: 'OK',
  })
})
afterEach(() => {
  api.defaults.adapter = originalAdapter
})

describe('rankings response contract', () => {
  it.each([
    ['demo fallback array', { success: true, data: [] }],
    ['missing histories', { success: true, data: { models: [], vendors: [] } }],
    ['failed business response', { success: false, message: 'Unavailable' }],
  ])(
    'rejects %s before it reaches the chart components',
    async (_name, response) => {
      payload = response
      await expect(getRankings('week')).rejects.toThrow()
    }
  )

  it('accepts empty Go slice fields without inventing ranking data', async () => {
    payload = {
      success: true,
      data: {
        models: null,
        vendors: null,
        top_movers: null,
        top_droppers: null,
        models_history: { points: null, models: null, buckets: 0 },
        vendor_share_history: { points: null, vendors: null, buckets: 0 },
      },
    }
    expect((await getRankings('today')).data).toEqual({
      models: [],
      vendors: [],
      top_movers: [],
      top_droppers: [],
      models_history: { points: [], models: [], buckets: 0 },
      vendor_share_history: { points: [], vendors: [], buckets: 0 },
    })
  })
})
