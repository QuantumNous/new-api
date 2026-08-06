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
import { describe, test } from 'node:test'

import { mergeDiscoveredModelMapping } from '../model-mapping-discovery.ts'

describe('mergeDiscoveredModelMapping', () => {
  test('adds selected endpoint mappings while preserving custom mappings', () => {
    const result = mergeDiscoveredModelMapping(
      '{"custom-alias":"upstream-model"}',
      {
        'Doubao-Seed-2.1-pro': 'ep-pro',
        'Doubao-Seed-2.1-lite': 'ep-lite',
      },
      ['Doubao-Seed-2.1-pro'],
      []
    )

    assert.deepEqual(JSON.parse(result), {
      'custom-alias': 'upstream-model',
      'Doubao-Seed-2.1-pro': 'ep-pro',
    })
  })

  test('removes endpoint mappings for deselected prior models only', () => {
    const result = mergeDiscoveredModelMapping(
      JSON.stringify({
        retired: 'ep-retired',
        alias: 'ep-manual-alias',
        custom: 'non-endpoint-target',
      }),
      { current: 'ep-current' },
      ['current'],
      ['retired', 'custom']
    )

    assert.deepEqual(JSON.parse(result), {
      alias: 'ep-manual-alias',
      custom: 'non-endpoint-target',
      current: 'ep-current',
    })
  })
})
