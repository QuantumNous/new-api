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
import { getUserModelAccess } from './api'

afterEach(() => {
  mock.restore()
})

describe('getUserModelAccess', () => {
  test('returns the typed data payload', async () => {
    const data = {
      scope_mode: 'fixed_account' as const,
      identity_scope: null,
      identity_model_ids: [],
      identity_model_ratios: {},
      identity_default_ratio: null,
      create_default_scope: null,
      groups: [],
      account_model_ids: [],
      account_model_ratios: {},
      account_default_ratio: 0,
      models: [],
    }
    spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data },
    } as never)

    await expect(getUserModelAccess()).resolves.toEqual(data)
  })

  test('rejects a business-error envelope instead of succeeding with undefined', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { success: false, message: 'denied' },
    } as never)

    await expect(getUserModelAccess()).rejects.toThrow('denied')
  })

  test('rejects a successful envelope that omits data', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { success: true },
    } as never)

    await expect(getUserModelAccess()).rejects.toThrow()
  })
})
