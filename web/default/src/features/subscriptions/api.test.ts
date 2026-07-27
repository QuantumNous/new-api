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
import { api, type ApiRequestConfig } from '@/lib/api'
import {
  cancelSubscriptionRenewal,
  getSelfSubscriptionFull,
  resumeSubscriptionRenewal,
} from './api'

afterEach(() => {
  mock.restore()
})

describe('getSelfSubscriptionFull', () => {
  test('passes request config through to the self-subscription request', async () => {
    const config: ApiRequestConfig = {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
    const response = { success: true, data: {} }
    spyOn(api, 'get').mockResolvedValue({ data: response } as never)

    await expect(getSelfSubscriptionFull(config)).resolves.toBe(response)

    expect(api.get).toHaveBeenCalledWith('/api/subscription/self', config)
  })
})

describe('subscription renewal lifecycle API', () => {
  test.each([
    ['cancel', cancelSubscriptionRenewal],
    ['resume', resumeSubscriptionRenewal],
  ] as const)(
    '%s keeps renewal error toasts owned by the caller',
    async (action, request) => {
      const response = { success: false, message: `${action} failed` }
      const post = spyOn(api, 'post').mockResolvedValue({
        data: response,
      } as never)

      await expect(request()).resolves.toEqual(response)
      expect(post).toHaveBeenCalledWith(
        `/api/subscription/self/renewal/${action}`,
        undefined,
        {
          skipBusinessError: true,
          skipErrorHandler: true,
        }
      )
    }
  )
})
