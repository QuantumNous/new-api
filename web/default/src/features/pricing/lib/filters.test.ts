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
  ENDPOINT_TYPES,
  FILTER_ALL,
  QUOTA_TYPES,
  SORT_OPTIONS,
} from '../constants'
import type { PricingModel } from '../types'
import { filterAndSortModels, sortModels } from './filters'

const models: PricingModel[] = [
  {
    id: 1,
    model_name: 'zeta-model',
    vendor_name: 'Other',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
  },
  {
    id: 2,
    model_name: 'gpt-5.6-luna',
    vendor_name: 'OpenAI',
    quota_type: 0,
    model_ratio: 2,
    completion_ratio: 1,
    enable_groups: ['default'],
  },
  {
    id: 3,
    model_name: 'claude-fable-5',
    vendor_name: 'Anthropic',
    quota_type: 0,
    model_ratio: 6,
    completion_ratio: 1,
    enable_groups: ['default'],
  },
  {
    id: 4,
    model_name: 'gpt-5.6-terra',
    vendor_name: 'OpenAI',
    quota_type: 0,
    model_ratio: 3,
    completion_ratio: 1,
    enable_groups: ['default'],
  },
  {
    id: 5,
    model_name: 'alpha-model',
    vendor_name: 'Other',
    quota_type: 0,
    model_ratio: 0.5,
    completion_ratio: 1,
    enable_groups: ['default'],
  },
  {
    id: 6,
    model_name: 'gpt-5.6-sol',
    vendor_name: 'OpenAI',
    quota_type: 0,
    model_ratio: 4,
    completion_ratio: 1,
    enable_groups: ['default'],
  },
]

describe('pricing model sorting', () => {
  test('promotes configured models in merchandising order', () => {
    const result = sortModels(models, SORT_OPTIONS.RECOMMENDED)

    assert.deepEqual(
      result.map((model) => model.model_name),
      [
        'claude-fable-5',
        'gpt-5.6-sol',
        'gpt-5.6-terra',
        'gpt-5.6-luna',
        'alpha-model',
        'zeta-model',
      ]
    )
  })

  test('filters before applying promoted model priority', () => {
    const result = filterAndSortModels(models, {
      search: '',
      vendor: 'OpenAI',
      group: FILTER_ALL,
      quotaType: QUOTA_TYPES.ALL,
      endpointType: ENDPOINT_TYPES.ALL,
      tag: FILTER_ALL,
      sortBy: SORT_OPTIONS.RECOMMENDED,
    })

    assert.deepEqual(
      result.map((model) => model.model_name),
      ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']
    )
  })

  test('keeps explicit name and price sorting semantics', () => {
    assert.deepEqual(
      sortModels(models, SORT_OPTIONS.NAME).map((model) => model.model_name),
      [
        'alpha-model',
        'claude-fable-5',
        'gpt-5.6-luna',
        'gpt-5.6-sol',
        'gpt-5.6-terra',
        'zeta-model',
      ]
    )
    assert.equal(
      sortModels(models, SORT_OPTIONS.PRICE_LOW)[0]?.model_name,
      'alpha-model'
    )
  })
})
