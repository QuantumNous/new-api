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
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { trackYahooApiKeyCreatedConversion } from './yahoo'

const originalWindow = globalThis.window

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

describe('trackYahooApiKeyCreatedConversion', () => {
  test('fires the Yahoo Display Ads conversion when ytag is available', () => {
    const calls: unknown[] = []

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        ytag: (payload: unknown) => calls.push(payload),
      },
    })

    trackYahooApiKeyCreatedConversion()

    assert.deepEqual(calls, [
      {
        type: 'yjad_conversion',
        config: {
          yahoo_ydn_conv_io: 'Dz41bC3JfMG6OsI3rXzAdw..',
          yahoo_ydn_conv_label: 'SN1YX2683R54C0FZG61360132',
          yahoo_ydn_conv_transaction_id: '',
          yahoo_ydn_conv_value: '0',
        },
      },
    ])
  })

  test('is a no-op when ytag is not available', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    })

    assert.doesNotThrow(() => trackYahooApiKeyCreatedConversion())
  })
})
