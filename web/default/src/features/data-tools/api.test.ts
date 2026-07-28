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
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { api } from '@/lib/api'
import { getDataTools, runDataTool } from './api'

afterEach(() => {
  mock.restore()
})

describe('data tools API', () => {
  test('loads a paginated Marketplace response', async () => {
    const data = {
      total: 4581,
      matched: 1653,
      page: 1,
      pageSize: 24,
      nextCursor: 'cursor',
      tools: [],
      platforms: [],
    }
    spyOn(api, 'get').mockResolvedValue({
      data: { success: true, message: '', data },
    } as never)

    await expect(
      getDataTools({ platform: 'TikHub', page: 1, page_size: 24 })
    ).resolves.toEqual(data)
    expect(api.get).toHaveBeenCalledWith('/api/data-tools', {
      params: { platform: 'TikHub', page: 1, page_size: 24 },
    })
  })

  test('sends Marketplace search queries to the catalogue API', async () => {
    const data = {
      total: 4581,
      matched: 1,
      page: 1,
      pageSize: 24,
      nextCursor: null,
      tools: [],
      platforms: [],
    }
    spyOn(api, 'get').mockResolvedValue({
      data: { success: true, message: '', data },
    } as never)

    await expect(
      getDataTools({
        q: 'gateway:monid:akta:/v1/news',
        page: 1,
        page_size: 24,
      })
    ).resolves.toEqual(data)
    expect(api.get).toHaveBeenCalledWith('/api/data-tools', {
      params: {
        q: 'gateway:monid:akta:/v1/news',
        page: 1,
        page_size: 24,
      },
    })
  })

  test('sends the caller-stable idempotency key on run', async () => {
    const data = {
      tool: 'provider.tool',
      output: { value: 1 },
      resultCount: 1,
      charged_quota: 500,
      charged_usd: 0.001,
      remaining_quota: 1000,
      replayed: false,
      latencyMs: 20,
    }
    spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: '', data },
    } as never)

    await expect(
      runDataTool('provider.tool', { query: 'test' }, 'idem-1', 'sk-flatkey')
    ).resolves.toEqual(data)
    expect(api.post).toHaveBeenCalledWith(
      '/api/data-tools/run',
      { id: 'provider.tool', input: { query: 'test' } },
      {
        headers: {
          Authorization: 'Bearer sk-flatkey',
          'Idempotency-Key': 'idem-1',
        },
        disableDuplicate: true,
      }
    )
  })

  test('rejects Flatkey business errors', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { success: false, message: 'provider not configured' },
    } as never)

    await expect(getDataTools({ page: 1 })).rejects.toThrow(
      'provider not configured'
    )
  })
})
