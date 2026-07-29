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

import type { PricingModel } from '../types'
import { groupModelsByVendor } from './model-helpers'

function model(name: string, vendor?: string): PricingModel {
  return {
    model_name: name,
    vendor_name: vendor,
    model_ratio: 1,
    completion_ratio: 1,
    quota_type: 0,
  } as PricingModel
}

describe('groupModelsByVendor order', () => {
  it('puts OpenAI, Google, DeepSeek, Moonshot before Anthropic and Other', () => {
    const groups = groupModelsByVendor(
      [
        model('claude-sonnet-5', 'Anthropic'),
        model('mystery', undefined),
        model('glm-5.2', 'Zhipu AI'),
        model('gpt-5.6', 'OpenAI'),
        model('kimi-k2.6', 'Moonshot AI'),
        model('deepseek-v4-flash', 'DeepSeek'),
        model('gemini-3.5-flash', 'Google'),
        model('grok-4.5', 'xAI'),
      ],
      'Other'
    )

    expect(groups.map((g) => g.name)).toEqual([
      'OpenAI',
      'Google',
      'DeepSeek',
      'Moonshot AI',
      'xAI',
      'Zhipu AI',
      'Anthropic',
      'Other',
    ])
  })
})
