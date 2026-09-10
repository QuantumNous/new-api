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
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { expect, test } from 'vitest'

import { api } from '@/lib/api'

import { redeemCode } from './api'

test('wallet redemption uses the strict unified endpoint and typed response', async () => {
  const originalAdapter = api.defaults.adapter
  let captured: InternalAxiosRequestConfig | undefined
  const adapter: AxiosAdapter = async (config) => {
    captured = config
    const response: AxiosResponse = {
      config,
      data: {
        success: true,
        message: '',
        data: {
          type: 'subscription',
          subscription_id: 72,
          plan_title: 'Professional',
          end_time: 1_900_000_000,
        },
      },
      headers: { 'content-type': 'application/json' },
      status: 200,
      statusText: 'OK',
    }
    return response
  }
  api.defaults.adapter = adapter

  try {
    const result = await redeemCode({ key: '  package-code  ' })
    expect(captured?.url).toBe('/api/user/redeem')
    expect(captured?.method).toBe('post')
    expect(captured?.data).toBe('{"key":"package-code"}')
    expect(result).toEqual({
      success: true,
      message: '',
      data: {
        type: 'subscription',
        subscription_id: 72,
        plan_title: 'Professional',
        end_time: 1_900_000_000,
      },
    })
  } finally {
    api.defaults.adapter = originalAdapter
  }
})
