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
import { describe, expect, test } from 'bun:test'
import { localizeSystemRewardContent } from './format'

describe('localizeSystemRewardContent', () => {
  test.each([
    ['Redemption code top-up: ＄10.000000 (ID: 42)', '＄10.000000'],
    ['通过兑换码充值 ＄10.000000 额度，兑换码ID 42', '＄10.000000'],
  ])('extracts redemption metadata from %s', (content, expectedAmount) => {
    const calls: Array<{
      key: string
      options?: Record<string, unknown>
    }> = []
    const result = localizeSystemRewardContent(content, (key, options) => {
      calls.push({ key, options })
      return 'localized redemption log'
    })

    expect(result).toBe('localized redemption log')
    expect(calls).toEqual([
      {
        key: 'Redemption code top-up: {{amount}} (ID: {{id}})',
        options: { amount: expectedAmount, id: '42' },
      },
    ])
  })
})
