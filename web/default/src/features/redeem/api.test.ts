/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

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
import { claimRedemptionCode, redeemCode } from './api'

afterEach(() => {
  mock.restore()
})

describe('redeem credits API', () => {
  test('claims an available code by purpose without triggering a generic toast', async () => {
    const response = {
      success: true,
      data: { key: 'yc-code', purpose: 'YCPrompt', quota: 500 },
    }
    const post = spyOn(api, 'post').mockResolvedValue({
      data: response,
    } as never)

    await expect(claimRedemptionCode('YCPrompt')).resolves.toEqual(response)
    expect(post).toHaveBeenCalledWith(
      '/api/user/redemption/claim',
      { purpose: 'YCPrompt' },
      { skipBusinessError: true }
    )
  })

  test('redeems the selected code through the existing wallet endpoint', async () => {
    const response = { success: true, data: 500 }
    const post = spyOn(api, 'post').mockResolvedValue({
      data: response,
    } as never)

    await expect(redeemCode('yc-code')).resolves.toEqual(response)
    expect(post).toHaveBeenCalledWith('/api/user/topup', { key: 'yc-code' })
  })
})
