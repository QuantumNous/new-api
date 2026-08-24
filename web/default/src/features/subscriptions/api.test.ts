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
import * as subscriptionApi from './api'
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
  const precondition = {
    expected_contract_id: 123,
    expected_change_version: 7,
    expected_current_period_end: 456,
    expected_renewal_source: 'wallet_auto',
    expected_renewal_status: 'enabled',
  } as const

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

      await expect(request(precondition)).resolves.toEqual(response)
      expect(post).toHaveBeenCalledWith(
        `/api/subscription/self/renewal/${action}`,
        precondition,
        {
          skipBusinessError: true,
          skipErrorHandler: true,
        }
      )
    }
  )

  test('does not expose legacy binding-id recurring helpers', () => {
    expect('cancelRecurringSubscription' in subscriptionApi).toBe(false)
    expect('resumeRecurringSubscription' in subscriptionApi).toBe(false)
  })
})
