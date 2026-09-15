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

import { filterCatalog, getCatalogModality, sortCatalog } from '../catalog'
import { formatUsdPerMillion, type SavingsModel } from '../pricing-savings'

function model(
  name: string,
  overrides: Partial<SavingsModel> = {}
): SavingsModel {
  return {
    modelName: name,
    vendorName: 'OpenAI',
    family: 'openai',
    baseInputPrice: 2,
    baseOutputPrice: 10,
    baseCacheReadPrice: null,
    baseCacheWritePrice: null,
    siteInputPrice: 1,
    siteOutputPrice: 5,
    siteCacheReadPrice: null,
    siteCacheWritePrice: null,
    savingsPercent: 50,
    ...overrides,
  }
}

describe('catalog helpers', () => {
  it('classifies image and video endpoints separately from text', () => {
    expect(
      getCatalogModality(
        model('gpt-image', { endpointTypes: ['image-generation'] })
      )
    ).toBe('image')
    expect(
      getCatalogModality(model('sora', { endpointTypes: ['openai-video'] }))
    ).toBe('video')
    expect(getCatalogModality(model('gpt-5'))).toBe('text')
  })

  it('filters by vendor, query, and modality', () => {
    const models = [
      model('gpt-5', { vendorName: 'OpenAI' }),
      model('claude-sonnet', { vendorName: 'Anthropic', family: 'anthropic' }),
      model('flux', {
        vendorName: 'Black Forest',
        family: 'other',
        endpointTypes: ['image-generation'],
      }),
    ]

    expect(
      filterCatalog(models, 'claude', 'all', 'all').map(
        (item) => item.modelName
      )
    ).toEqual(['claude-sonnet'])
    expect(
      filterCatalog(models, '', 'OpenAI', 'all').map((item) => item.modelName)
    ).toEqual(['gpt-5'])
    expect(
      filterCatalog(models, '', 'all', 'image').map((item) => item.modelName)
    ).toEqual(['flux'])
  })

  it('sorts by discount and live output price', () => {
    const models = [
      model('mid', { savingsPercent: 20, siteOutputPrice: 3 }),
      model('high', { savingsPercent: 60, siteOutputPrice: 8 }),
      model('cheap', { savingsPercent: 20, siteOutputPrice: 1 }),
    ]

    expect(
      sortCatalog(models, 'discount-desc').map((item) => item.modelName)
    ).toEqual(['high', 'cheap', 'mid'])
    expect(
      sortCatalog(models, 'price-asc').map((item) => item.modelName)
    ).toEqual(['cheap', 'mid', 'high'])
  })
})

describe('formatUsdPerMillion', () => {
  it('formats token rates in the catalog unit', () => {
    expect(formatUsdPerMillion(0.06)).toBe('$0.06/M')
    expect(formatUsdPerMillion(7)).toBe('$7.00/M')
    expect(formatUsdPerMillion(0.005)).toBe('$0.005/M')
  })
})
