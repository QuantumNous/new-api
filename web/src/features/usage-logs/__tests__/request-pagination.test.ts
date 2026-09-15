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
import { afterEach, describe, expect, it } from 'vitest'

import { api } from '@/lib/api'

import { getUserRequestLogs } from '../api'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

describe('request history pagination', () => {
  it('loads a deep page with one server-filtered request', async () => {
    const requests: URL[] = []
    api.defaults.adapter = async (config) => {
      const url = new URL(config.url ?? '', 'http://localhost')
      requests.push(url)
      const types = url.searchParams.get('types')
      const type = Number(url.searchParams.get('type') ?? 0)
      const page = Number(url.searchParams.get('p') ?? 1)
      const pageSize = Number(url.searchParams.get('page_size') ?? 20)
      const items = types
        ? []
        : Array.from({ length: pageSize }, (_, index) => ({
            id: index + 1,
            created_at: 10_000 - (page - 1) * pageSize - index,
            type,
          }))

      return {
        config,
        data: {
          success: true,
          data: { items, total: 10_000, page, page_size: pageSize },
        },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }

    const result = await getUserRequestLogs({
      p: 100,
      page_size: 50,
      request_id: 'retry-to-inspect',
    })

    expect(result.data?.page).toBe(100)
    expect(requests).toHaveLength(1)
    expect(requests[0].pathname).toBe('/api/log/self')
    expect(requests[0].searchParams.get('request_id')).toBe('retry-to-inspect')
    expect(requests[0].searchParams.get('types')).toBe('2,5')
    expect(requests[0].searchParams.get('p')).toBe('100')
    expect(requests[0].searchParams.get('page_size')).toBe('50')
  })
})
