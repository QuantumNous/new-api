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
import { describe, expect, it } from 'vitest'
import {
  dedupePricingModels,
  filterAndSortModels,
} from './filters'
import { SORT_OPTIONS, FILTER_ALL, QUOTA_TYPES, ENDPOINT_TYPES } from '../constants'
import type { PricingModel } from '../types'

function model(partial: Partial<PricingModel> & { model_name: string }): PricingModel {
  return {
    id: partial.id ?? 1,
    model_name: partial.model_name,
    quota_type: partial.quota_type ?? 0,
    model_ratio: partial.model_ratio ?? 1,
    completion_ratio: partial.completion_ratio ?? 1,
    model_price: partial.model_price,
    enable_groups: partial.enable_groups ?? ['default'],
    vendor_name: partial.vendor_name,
  }
}

describe('dedupePricingModels', () => {
  it('collapses case-only duplicates', () => {
    const out = dedupePricingModels([
      model({ id: 1, model_name: 'GPT-4o', model_ratio: 2 }),
      model({ id: 2, model_name: 'gpt-4o', model_ratio: 1 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].model_name).toBe('gpt-4o')
  })

  it('hides free/path variants when base exists', () => {
    const out = dedupePricingModels([
      model({ id: 1, model_name: 'gpt-4o' }),
      model({ id: 2, model_name: 'gpt-4o:free' }),
      model({ id: 3, model_name: 'OpenAI/gpt-4o' }),
      model({ id: 4, model_name: 'claude-sonnet-4' }),
    ])
    const names = out.map((m) => m.model_name).sort()
    expect(names).toEqual(['claude-sonnet-4', 'gpt-4o'])
  })

  it('keeps free variant when no base card', () => {
    const out = dedupePricingModels([
      model({ id: 1, model_name: 'llama-3.1-8b:free' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].model_name).toBe('llama-3.1-8b:free')
  })
})

describe('filterAndSortModels dedupe integration', () => {
  it('dedupes before search', () => {
    const out = filterAndSortModels(
      [
        model({ id: 1, model_name: 'Deepseek-V4-Flash' }),
        model({ id: 2, model_name: 'deepseek-v4-flash' }),
      ],
      {
        search: '',
        vendor: FILTER_ALL,
        group: FILTER_ALL,
        quotaType: QUOTA_TYPES.ALL,
        endpointType: ENDPOINT_TYPES.ALL,
        tag: FILTER_ALL,
        sortBy: SORT_OPTIONS.NAME,
      }
    )
    expect(out).toHaveLength(1)
  })
})
