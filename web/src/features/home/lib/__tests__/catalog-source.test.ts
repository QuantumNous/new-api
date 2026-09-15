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

import type { PricingModel } from '@/features/pricing/types'

import {
  buildModelCatalog,
  catalogVendorAvatar,
  familyIconName,
  filterCatalog,
} from '../catalog'

const model: PricingModel = {
  id: 1,
  model_name: 'text',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 2,
  enable_groups: ['default'],
  group_ratio: { default: 1 },
}

describe('complete model catalog', () => {
  it('retains request, task and complex tier models without inventing token quotes', () => {
    const catalog = buildModelCatalog(
      [
        model,
        {
          ...model,
          id: 2,
          model_name: 'image',
          quota_type: 1,
          model_price: 0.1,
          supported_endpoint_types: ['image-generation'],
        },
        {
          ...model,
          id: 3,
          model_name: 'video',
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("seconds") * 0.1)',
          billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
          supported_endpoint_types: ['openai-video'],
        },
        {
          ...model,
          id: 4,
          model_name: 'tiered',
          billing_mode: 'tiered_expr',
          billing_expr:
            'p > 200000 ? tier("long", p * 4) : tier("short", p * 2)',
        },
      ],
      7
    )
    expect(catalog.map((item) => item.modelName)).toEqual([
      'text',
      'image',
      'video',
      'tiered',
    ])
    expect(catalog[0].quote).not.toBeNull()
    expect(catalog.slice(1).every((item) => item.quote === null)).toBe(true)
    expect(
      filterCatalog(catalog, '', 'all', 'video').map((item) => item.modelName)
    ).toEqual(['video'])
  })

  it('never treats an icon identifier as an image URL', () => {
    const catalog = buildModelCatalog([{ ...model, vendor_icon: 'OpenAI' }], 1)
    expect(catalogVendorAvatar(catalog[0])).toBeNull()
    expect(
      catalogVendorAvatar({ ...catalog[0], vendorIcon: '/logo.png' })
    ).toBe('/logo.png')
  })

  it('uses configured vendor names for icon fallback without impersonating Zhipu', () => {
    const catalog = buildModelCatalog(
      [
        { ...model, id: 11, model_name: 'mimo-v2.5', vendor_name: 'Xiaomi' },
        { ...model, id: 12, model_name: 'hy4-preview', vendor_name: 'Tencent' },
        { ...model, id: 13, model_name: 'kimi-k3', vendor_name: 'Moonshot AI' },
        { ...model, id: 14, model_name: 'private-model', vendor_name: 'Acme' },
      ],
      1
    )

    expect(
      catalog.map((entry) => ({
        vendor: entry.vendorName,
        image: catalogVendorAvatar(entry),
        icon: familyIconName(entry),
      }))
    ).toEqual([
      { vendor: 'Xiaomi', image: null, icon: 'XiaomiMiMo' },
      { vendor: 'Tencent', image: null, icon: 'Hunyuan.Color' },
      { vendor: 'Moonshot AI', image: null, icon: 'Kimi.Color' },
      { vendor: 'Acme', image: null, icon: 'Acme' },
    ])
  })
})
