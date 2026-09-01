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
  buildSavingsCatalog,
  buildSavingsModels,
  calculateSavingsEstimate,
  formatCnyAmount,
  formatTokenMillions,
  tokenMillionsToSliderPosition,
  tokenSliderPositionToMillions,
  type SavingsModel,
} from '../pricing-savings'

function makePricingModel(
  modelName: string,
  modelRatio: number,
  overrides: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: modelName.length,
    model_name: modelName,
    quota_type: 0,
    model_ratio: modelRatio,
    completion_ratio: 2,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

function makeSavingsModel(
  modelName: string,
  family: SavingsModel['family'],
  prices: {
    officialInput: number
    officialOutput: number
    siteInput: number
    siteOutput: number
  }
): SavingsModel {
  return {
    modelName,
    vendorName: modelName,
    family,
    officialInputPrice: prices.officialInput,
    officialOutputPrice: prices.officialOutput,
    siteInputPrice: prices.siteInput,
    siteOutputPrice: prices.siteOutput,
    savingsPercent: 50,
  }
}

describe('buildSavingsModels', () => {
  it('selects the newest available model in each family instead of the most expensive one', () => {
    const models = buildSavingsModels(
      [
        makePricingModel('gpt-5.2', 8),
        makePricingModel('gpt-5.6', 4),
        makePricingModel('deepseek-v3.2', 3),
        makePricingModel('deepseek-v4', 2),
      ],
      4,
      7
    )

    expect(models.slice(0, 2).map((model) => model.modelName)).toEqual([
      'gpt-5.6',
      'deepseek-v4',
    ])
    expect(models).toHaveLength(2)
  })

  it('uses live group and recharge ratios while excluding request pricing', () => {
    const models = buildSavingsModels(
      [
        makePricingModel('gpt-5', 4, {
          completion_ratio: 3,
          enable_groups: ['standard', 'value'],
          group_ratio: { standard: 1, value: 0.5 },
        }),
        makePricingModel('image-request-model', 100, { quota_type: 1 }),
      ],
      4,
      5
    )

    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      officialInputPrice: 40,
      officialOutputPrice: 120,
      siteInputPrice: 16,
      savingsPercent: 60,
    })
    expect(models[0].siteOutputPrice).toBeCloseTo(48)
  })

  it('returns no comparison rows when pricing has no valid token model', () => {
    expect(
      buildSavingsModels(
        [makePricingModel('request-only', 1, { quota_type: 1 })],
        1,
        1
      )
    ).toEqual([])
  })

  it('keeps the complete live token catalog available to the calculator', () => {
    const sourceModels = Array.from({ length: 8 }, (_, index) =>
      makePricingModel(`custom-model-${index + 1}`, index + 1)
    )

    expect(buildSavingsModels(sourceModels, 4, 7)).toHaveLength(1)
    expect(buildSavingsCatalog(sourceModels, 4, 7)).toHaveLength(8)
  })
})

describe('localized display values', () => {
  it('formats all savings as Chinese yuan', () => {
    expect(formatCnyAmount(110_000, { compact: true })).toBe('¥11万')
    expect(formatCnyAmount(6_100)).toBe('¥6,100')
  })

  it('spells out Chinese token quantities for non-technical readers', () => {
    expect(formatTokenMillions(1, 'zh-CN')).toBe('100万')
    expect(formatTokenMillions(200, 'zh-CN')).toBe('2亿')
    expect(formatTokenMillions(20, 'zhCN')).toBe('2000万')
  })
})

describe('calculateSavingsEstimate', () => {
  it('calculates coding savings from a one-to-three input-output mix', () => {
    const estimate = calculateSavingsEstimate(
      [
        makeSavingsModel('claude-flagship', 'anthropic', {
          officialInput: 2,
          officialOutput: 6,
          siteInput: 1,
          siteOutput: 3,
        }),
        makeSavingsModel('gpt-flagship', 'openai', {
          officialInput: 4,
          officialOutput: 8,
          siteInput: 2,
          siteOutput: 4,
        }),
      ],
      'coding',
      20,
      2
    )

    expect(estimate.representativeModels).toHaveLength(2)
    expect(estimate.officialMonthlyCost).toBe(240)
    expect(estimate.siteMonthlyCost).toBe(120)
    expect(estimate.monthlySavings).toBe(120)
    expect(estimate.annualSavings).toBe(1440)
  })

  it('never presents a negative saving when the site price is higher', () => {
    const estimate = calculateSavingsEstimate(
      [
        makeSavingsModel('support-model', 'deepseek', {
          officialInput: 1,
          officialOutput: 1,
          siteInput: 2,
          siteOutput: 2,
        }),
      ],
      'support',
      10,
      1
    )

    expect(estimate.monthlySavings).toBe(0)
    expect(estimate.annualSavings).toBe(0)
  })
})

describe('token slider scale', () => {
  it('maps the logarithmic range to the documented token boundaries', () => {
    expect(tokenSliderPositionToMillions(0)).toBe(1)
    expect(tokenSliderPositionToMillions(100)).toBe(200)
    expect(
      tokenSliderPositionToMillions(tokenMillionsToSliderPosition(20))
    ).toBeCloseTo(20, 0)
  })
})
