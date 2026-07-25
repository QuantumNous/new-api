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
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'
import { api } from '@/lib/api'
import { batchEditApiKeys, searchApiKeys } from './api'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

describe('batchEditApiKeys', () => {
  test('uses generic PUT endpoint and preserves explicit zero quota', async () => {
    let request: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      request = config
      return {
        data: { success: true, data: 2 },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      }
    }

    const result = await batchEditApiKeys({
      ids: [4, 8],
      group: 'premium',
      remain_quota: 0,
    })

    expect(request?.method).toBe('put')
    expect(request?.url).toBe('/api/token/batch')
    expect(JSON.parse(String(request?.data))).toEqual({
      ids: [4, 8],
      group: 'premium',
      remain_quota: 0,
    })
    expect(result).toEqual({ success: true, data: 2 })
  })
})

describe('searchApiKeys', () => {
  test('sends the status filter with pagination', async () => {
    let request: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      request = config
      return {
        data: { success: true, data: { items: [], total: 0 } },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      }
    }

    await searchApiKeys({ status: 3, p: 1, size: 20 })

    expect(request?.method).toBe('get')
    expect(request?.url).toBe('/api/token/search?status=3&p=1&size=20')
  })
})
