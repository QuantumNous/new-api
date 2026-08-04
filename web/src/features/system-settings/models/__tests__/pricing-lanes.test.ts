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
  buildPreviewRows,
  createInitialLaneState,
  laneConfigs,
  type ModelPricingFormValues,
} from '../model-pricing-core'

const translate = (key: string) => key

describe('model pricing lanes', () => {
  test('renames the core price labels without removing image or audio lanes', () => {
    assert.deepEqual(
      laneConfigs.map((lane) => [lane.key, lane.titleKey]),
      [
        ['completion', 'Output price'],
        ['cache', 'Cache read price'],
        ['createCache', 'Cache create price'],
        ['image', 'Image input price'],
        ['audioInput', 'Audio input price'],
        ['audioOutput', 'Audio output price'],
      ]
    )
  })

  test('keeps image and audio ratios in the visible lane state', () => {
    const state = createInitialLaneState({
      name: 'multimodal-model',
      ratio: '1.5',
      completionRatio: '5',
      cacheRatio: '0.1',
      createCacheRatio: '1.25',
      imageRatio: '2',
      audioRatio: '3',
      audioCompletionRatio: '4',
    })

    assert.deepEqual(state.prices, {
      completion: '15',
      cache: '0.3',
      createCache: '3.75',
      image: '6',
      audioInput: '9',
      audioOutput: '36',
    })
    assert.deepEqual(state.enabled, {
      completion: true,
      cache: true,
      createCache: true,
      image: true,
      audioInput: true,
      audioOutput: true,
    })
  })

  test('renders all seven token pricing rows in the preview', () => {
    const values: ModelPricingFormValues = {
      name: 'multimodal-model',
      price: '',
      ratio: '1.5',
      completionRatio: '5',
      cacheRatio: '0.1',
      createCacheRatio: '1.25',
      imageRatio: '2',
      audioRatio: '3',
      audioCompletionRatio: '4',
    }

    const rows = buildPreviewRows(
      values,
      'per-token',
      '',
      '',
      '3',
      {
        completion: '15',
        cache: '0.3',
        createCache: '3.75',
        image: '6',
        audioInput: '9',
        audioOutput: '36',
      },
      {
        completion: true,
        cache: true,
        createCache: true,
        image: true,
        audioInput: true,
        audioOutput: true,
      },
      translate
    )

    assert.deepEqual(
      rows.map((row) => row.label),
      [
        'Input price',
        'Output price',
        'Cache read price',
        'Cache create price',
        'Image input price',
        'Audio input price',
        'Audio output price',
      ]
    )
  })
})
