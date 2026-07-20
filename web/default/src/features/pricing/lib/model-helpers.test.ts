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

import type { PricingModel } from '../types'
import { filterByGroup } from './filters'
import { expandModelsByGroup, formatGroupRatio } from './model-helpers'

const models: PricingModel[] = [
  {
    id: 1,
    model_name: 'grouped-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default', 'vip', 'hidden'],
  },
  {
    id: 2,
    model_name: 'wildcard-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['all'],
  },
]

describe('model group display entries', () => {
  test('expands each model into its selectable group prices', () => {
    const result = expandModelsByGroup(models, 'all', ['default', 'vip'], {
      default: 1,
      vip: 0.8,
    })

    assert.deepEqual(
      result.map((model) => [
        model.model_name,
        model.display_group,
        model.display_group_ratio,
        model.key,
      ]),
      [
        ['grouped-model', 'default', 1, 'grouped-model::default'],
        ['grouped-model', 'vip', 0.8, 'grouped-model::vip'],
        ['wildcard-model', 'default', 1, 'wildcard-model::default'],
        ['wildcard-model', 'vip', 0.8, 'wildcard-model::vip'],
      ]
    )
  })

  test('keeps only the selected group and defaults a missing ratio to one', () => {
    const result = expandModelsByGroup(models, 'vip', ['default', 'vip'], {})

    assert.deepEqual(
      result.map((model) => [
        model.model_name,
        model.display_group,
        model.display_group_ratio,
      ]),
      [
        ['grouped-model', 'vip', 1],
        ['wildcard-model', 'vip', 1],
      ]
    )
  })

  test('does not render unavailable or reserved groups', () => {
    const result = expandModelsByGroup(
      models,
      'all',
      ['default', 'auto', 'all'],
      { default: 1, auto: 0.5, all: 0.1 }
    )

    assert.deepEqual(
      result.map((model) => model.display_group),
      ['default', 'default']
    )
  })

  test('treats the all capability group as matching a selected group', () => {
    assert.deepEqual(
      filterByGroup(models, 'vip').map((model) => model.model_name),
      ['grouped-model', 'wildcard-model']
    )
  })

  test('formats finite group multipliers', () => {
    assert.equal(formatGroupRatio(1), 'x1')
    assert.equal(formatGroupRatio(0.125), 'x0.125')
    assert.equal(formatGroupRatio(Number.NaN), undefined)
  })
})
