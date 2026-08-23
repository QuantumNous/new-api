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
import { describe, expect, test } from 'vitest'

import {
  DEFAULT_SEEDANCE_PRICES,
  parseSeedancePriceTable,
  rowsToTable,
  tableToRows,
} from '../seedance-price'

describe('seedance price table', () => {
  test('falls back to official defaults for empty input', () => {
    expect(parseSeedancePriceTable('')).toEqual(DEFAULT_SEEDANCE_PRICES)
    expect(parseSeedancePriceTable('{}')).toEqual(DEFAULT_SEEDANCE_PRICES)
  })

  test('round-trips visual rows without dropping official cells', () => {
    const rows = tableToRows(DEFAULT_SEEDANCE_PRICES)
    expect(rowsToTable(rows)).toEqual(DEFAULT_SEEDANCE_PRICES)
  })

  test('keeps a custom alias row', () => {
    const table = parseSeedancePriceTable(
      JSON.stringify({
        'my-seedance': {
          text: { '720p': 10, '1080p': 20 },
          video: { '720p': 5 },
        },
      })
    )
    expect(table['my-seedance']).toEqual({
      text: { '720p': 10, '1080p': 20 },
      video: { '720p': 5 },
    })
  })
})
