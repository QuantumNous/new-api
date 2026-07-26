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

import type { PricingData } from '@/features/pricing/types'

import { fillProviderMarquee, getHomeCatalogModels } from './catalog'

const catalog: PricingData = {
  success: true,
  data: [
    {
      id: 101,
      model_name: 'active-model',
      vendor_id: 2,
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
    },
    {
      id: 102,
      model_name: 'unassigned-model',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
    },
  ],
  vendors: [
    { id: 1, name: 'Configured but inactive' },
    { id: 2, name: 'Active provider', icon: 'OpenAI' },
  ],
  group_ratio: { default: 1 },
  usable_group: {},
  supported_endpoint: {},
  auto_groups: [],
}

describe('home catalog helpers', () => {
  test('joins visible models with provider metadata and group ratios', () => {
    const models = getHomeCatalogModels(catalog)

    assert.equal(models[0].vendor_name, 'Active provider')
    assert.equal(models[0].vendor_icon, 'OpenAI')
    assert.deepEqual(models[0].group_ratio, { default: 1 })
    assert.equal(models[1].vendor_name, undefined)
  })

  test('repeats a short provider list enough for a continuous wide marquee', () => {
    const providers = fillProviderMarquee(catalog.vendors.slice(1))

    assert.equal(providers.length, 12)
    assert.equal(
      providers.every((provider) => provider.id === 2),
      true
    )
    assert.deepEqual(fillProviderMarquee([]), [])
  })
})
