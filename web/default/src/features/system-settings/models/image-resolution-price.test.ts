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

import {
  isImageResolutionPriceMap,
  normalizeImageResolution,
  removeImageResolutionPriceModel,
  removeImageResolutionPriceModels,
  renameImageResolutionPriceModel,
} from './image-resolution-price'

describe('image resolution price settings', () => {
  test('matches backend resolution normalization and price bounds', () => {
    assert.equal(normalizeImageResolution(' 1k '), '1K')
    assert.equal(normalizeImageResolution('+2K'), null)
    assert.equal(normalizeImageResolution('0003'), null)
    assert.equal(normalizeImageResolution('0K'), null)
    assert.equal(normalizeImageResolution('auto'), null)
    assert.equal(
      normalizeImageResolution('9223372036854775808'),
      '9223372036854775808'
    )

    assert.equal(
      isImageResolutionPriceMap({
        'image-model': { ' 1k ': 0, '4K': 1.25 },
      }),
      true
    )
    assert.equal(
      isImageResolutionPriceMap({
        'image-model': { '1k': 0.25, ' 1K ': 0.5 },
      }),
      false
    )
    assert.equal(
      isImageResolutionPriceMap({
        'image-model': { '1K': 0.25 },
        ' image-model ': { '4K': 0.5 },
      }),
      false
    )
    assert.equal(
      isImageResolutionPriceMap({ 'image-model': { '0K': 0.25 } }),
      false
    )
    assert.equal(
      isImageResolutionPriceMap({ 'image-model': { '1K': -0.01 } }),
      false
    )
  })

  test('removes a deleted model without mutating other price entries', () => {
    const original = {
      old: { '1K': 0.1 },
      retained: { '2K': 0.2 },
    }

    const next = removeImageResolutionPriceModel(original, 'old')

    assert.deepEqual(next, { retained: { '2K': 0.2 } })
    assert.deepEqual(original, {
      old: { '1K': 0.1 },
      retained: { '2K': 0.2 },
    })
  })

  test('moves model-specific prices when a model is renamed', () => {
    const original = {
      old: { '1K': 0.1, '4K': 0.4 },
      retained: { '2K': 0.2 },
    }

    const next = renameImageResolutionPriceModel(original, 'old', 'renamed')

    assert.deepEqual(next, {
      renamed: { '1K': 0.1, '4K': 0.4 },
      retained: { '2K': 0.2 },
    })
    assert.deepEqual(original, {
      old: { '1K': 0.1, '4K': 0.4 },
      retained: { '2K': 0.2 },
    })
  })

  test('matches trimmed model names when removing and renaming entries', () => {
    const original = {
      ' first ': { '1K': 0.1 },
      second: { '2K': 0.2 },
      retained: { '4K': 0.4 },
    }

    assert.deepEqual(
      removeImageResolutionPriceModels(original, ['first', ' second ']),
      { retained: { '4K': 0.4 } }
    )
    assert.deepEqual(
      renameImageResolutionPriceModel(original, ' first', 'new'),
      {
        new: { '1K': 0.1 },
        second: { '2K': 0.2 },
        retained: { '4K': 0.4 },
      }
    )
  })
})
