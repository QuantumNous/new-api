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

import { describe, expect, test } from 'vitest'

import { getBillingModeLabelKey } from '../lib/billing-mode'
import {
  getCardExamplePrice,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  getTaskUsagePriceUnitLabelKey,
  hasTaskUsageSchema,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

const summaryOptions = {
  tokenUnit: 'K' as const,
  showRechargePrice: true,
  priceRate: 3,
  usdExchangeRate: 6,
  groupRatioMultiplier: 2,
}

describe('expression price summaries', () => {
  test('preserves a versioned parenthesized base price and its request rule', () => {
    const summary = getDynamicPricingSummary(
      pricingModel({
        billing_mode: 'tiered_expr',
        billing_expr:
          'v1:(tier("base", p * 2 + c * 8)) * (header("x-priority") == "high" ? 2 : 1)',
      }),
      { tokenUnit: 'M' }
    )
    expect(summary?.isSpecialExpression).toBe(false)
    expect(summary?.primaryEntries.map((entry) => entry.value)).toEqual([2, 8])
    expect(summary?.hasRequestRules).toBe(true)
  })
  test.each([
    'tier("custom", max(p * 2 + c * 8, 100))',
    'tier("base", p * 2 + c * 8) * 3',
    'param("premium") ? tier("pro", p * 4 + c * 16) : tier("base", p * 2 + c * 8)',
    'tier("overflow", p * 1e999 + c * 8)',
  ])('does not invent structured prices from %s', (expression) => {
    const summary = getDynamicPricingSummary(
      pricingModel({ billing_mode: 'tiered_expr', billing_expr: expression }),
      { tokenUnit: 'M' }
    )
    expect(summary?.isSpecialExpression).toBe(true)
    expect(summary?.entries).toEqual([])
  })

  test('retains explicit zero token rates while omitting absent categories', () => {
    const summary = getDynamicPricingSummary(
      pricingModel({
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("free", p * 0 + c * 0)',
      }),
      { tokenUnit: 'M' }
    )
    expect(
      summary?.primaryEntries.map((entry) => [entry.field, entry.value])
    ).toEqual([
      ['inputPrice', 0],
      ['outputPrice', 0],
    ])
    expect(summary?.secondaryEntries).toEqual([])
  })

  test('includes a free task tier in its range', () => {
    const summary = getDynamicPricingSummary(
      pricingModel({
        billing_mode: 'tiered_expr',
        billing_expr:
          'u("mode") == "pro" ? tier("pro", u("seconds") * 0.8) : tier("free", u("seconds") * 0)',
        billing_usage_schema: {
          seconds: { type: 'number', unit: 'second' },
          mode: { enum: ['free', 'pro'] },
        },
      }),
      { tokenUnit: 'M' }
    )
    expect(summary?.primaryEntries[0]?.value).toBe(0)
    expect(summary?.primaryEntries[0]?.formattedRange).toBe('$0 – $0.8')
  })
})

describe('task dynamic pricing', () => {
  test('summarizes task tiers in dollars per unit with their fallback price and range', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr:
        'u("mode") == "pro" ? tier("pro", u("seconds") * 0.8) : tier("std", u("seconds") * 0.4)',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
        mode: { enum: ['std', 'pro'] },
      },
    })

    const summary = getDynamicPricingSummary(model, summaryOptions)

    if (!summary) expect.fail('Expected summary to be present')
    expect(summary.isTaskUsage).toBe(true)
    expect(summary.isSpecialExpression).toBe(false)
    expect(summary.tier?.label).toBe('std')
    expect(summary.primaryEntries[0]?.value).toBe(0.4)
    expect(summary.primaryEntries[0]?.unit).toBe('second')
    expect(summary.primaryEntries[0]?.formatted ?? '').toMatch(/0[.,]4/)
    expect(summary.primaryEntries[0]?.formattedRange ?? '').toMatch(/0[.,]4/)
    expect(summary.primaryEntries[0]?.formattedRange ?? '').toMatch(/0[.,]8/)
    expect(summary.primaryEntries[0]?.formattedRange ?? '').toMatch(/\S – \S/)
  })

  test('falls back for a non-canonical task expression', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr:
        'u("seconds") > 30 ? tier("long", u("seconds") * 0.3) : tier("short", u("seconds") * 0.4)',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })

    const summary = getDynamicPricingSummary(model, summaryOptions)

    if (!summary) expect.fail('Expected summary to be present')
    expect(summary.isSpecialExpression).toBe(true)
    expect(summary.tiers.length).toBe(0)
  })

  test('omits a task price range when every tier has the same unit price', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("seconds") * 0.4)',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })

    const summary = getDynamicPricingSummary(model, summaryOptions)

    if (!summary) expect.fail('Expected summary to be present')
    expect(summary.primaryEntries[0]?.formattedRange).toBe(undefined)
  })

  test('identifies unconfigured task usage models without inventing token pricing', () => {
    const secondsModel = pricingModel({
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })
    const countModel = pricingModel({
      billing_usage_schema: {
        clips: { type: 'number', unit: 'count' },
      },
    })

    expect(hasTaskUsageSchema(secondsModel)).toBe(true)
    expect(isUnconfiguredTaskUsageModel(secondsModel)).toBe(true)
    expect(getDynamicPricingSummary(secondsModel, summaryOptions)).toBe(null)
    expect(getBillingModeLabelKey(secondsModel)).toBe('Task billing')
    expect(getBillingModeLabelKey(countModel)).toBe('Task billing')
  })

  test('does not mark configured task usage pricing as unconfigured', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("seconds") * 0.4)',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })

    expect(isUnconfiguredTaskUsageModel(model)).toBe(false)
    expect(getDynamicPricingSummary(model, summaryOptions)).toBeTruthy()
  })

  test('leaves fixed per-request pricing configured when a usage schema is present', () => {
    const model = pricingModel({
      quota_type: 1,
      model_price: 0.5,
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })

    expect(isUnconfiguredTaskUsageModel(model)).toBe(false)
    expect(getDynamicPricingSummary(model, summaryOptions)).toBe(null)
    expect(isTokenBasedModel(model)).toBe(false)
  })

  test('labels task token usage prices without changing chat token units', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("tokens") * 9.8 / 1000000)',
      billing_usage_schema: {
        tokens: { type: 'number', unit: 'token' },
      },
    })

    const summary = getDynamicPricingSummary(model, summaryOptions)

    if (!summary) expect.fail('Expected summary to be present')
    const tokenEntry = summary.primaryEntries[0]
    if (!tokenEntry) expect.fail('Expected tokenEntry to be present')
    expect(tokenEntry.unit).toBe('token')
    expect(tokenEntry.value).toBe(9.8)
    expect(getDynamicPriceUnitLabelKey(tokenEntry)).toBe('1M token')
    expect(getTaskUsagePriceUnitLabelKey('token')).toBe('1M token')
    expect(
      getDynamicPriceUnitLabelKey({
        key: 'p',
        field: 'inputPrice',
        label: 'Input',
        shortLabel: 'Input',
        labelKind: 'i18n',
        value: 2,
        formatted: '$2',
        unit: 'token',
        variable: {
          key: 'p',
          field: 'inputPrice',
          tierField: 'input_unit_cost',
          label: 'Input price',
          shortLabel: 'Input',
          side: 'input',
        },
      })
    ).toBe(null)
  })

  test('labels task credit usage prices as a direct per-credit rate', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("units") * 0.14)',
      billing_usage_schema: {
        units: { type: 'number', unit: 'credit' },
      },
    })

    const summary = getDynamicPricingSummary(model, summaryOptions)

    if (!summary) expect.fail('Expected summary to be present')
    const creditEntry = summary.primaryEntries[0]
    if (!creditEntry) expect.fail('Expected creditEntry to be present')
    expect(creditEntry.unit).toBe('credit')
    expect(creditEntry.value).toBe(0.14)
    expect(getDynamicPriceUnitLabelKey(creditEntry)).toBe('credit')
    expect(getTaskUsagePriceUnitLabelKey('credit')).toBe('credit')
  })

  test('leaves token models without a usage schema unchanged', () => {
    const model = pricingModel({})

    expect(hasTaskUsageSchema(model)).toBe(false)
    expect(isUnconfiguredTaskUsageModel(model)).toBe(false)
    expect(getBillingModeLabelKey(model)).toBe('Token-based')
  })

  test('preserves all billing-mode badge states', () => {
    expect(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("seconds") * 0.4)',
          billing_usage_schema: {
            seconds: { type: 'number', unit: 'second' },
          },
        })
      )
    ).toBe('Task billing')
    expect(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("clips") * 0.05)',
          billing_usage_schema: {
            clips: { type: 'number', unit: 'count' },
          },
        })
      )
    ).toBe('Task billing')
    expect(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("tokens") * 9.8 / 1000000)',
          billing_usage_schema: {
            tokens: { type: 'number', unit: 'token' },
          },
        })
      )
    ).toBe('Task billing')
    expect(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("units") * 0.14)',
          billing_usage_schema: {
            units: { type: 'number', unit: 'credit' },
          },
        })
      )
    ).toBe('Task billing')
    expect(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", p * 2 + c * 8)',
        })
      )
    ).toBe('Dynamic Pricing')
    expect(getBillingModeLabelKey(pricingModel({}))).toBe('Token-based')
    expect(getBillingModeLabelKey(pricingModel({ quota_type: 1 }))).toBe(
      'Per Request'
    )
  })

  test('marks task usage field labels as schema-owned so they are not translated', () => {
    const tokenModel = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", 0.1 + u("tokens") * 9.8 / 1000000)',
      billing_usage_schema: {
        tokens: { type: 'number', unit: 'token' },
      },
    })
    const tokenSummary = getDynamicPricingSummary(tokenModel, summaryOptions)
    if (!tokenSummary) expect.fail('Expected tokenSummary to be present')
    expect(tokenSummary.primaryEntries[0]?.shortLabel).toBe('tokens')
    expect(tokenSummary.primaryEntries[0]?.labelKind).toBe('schema')
    expect(tokenSummary.secondaryEntries[0]?.shortLabel).toBe(
      'Additional charge'
    )
    expect(tokenSummary.secondaryEntries[0]?.labelKind).toBe('i18n')

    const multiFieldModel = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr:
        'tier("base", u("seconds") * 0.4 + u("tokens") * 9.8 / 1000000)',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
        tokens: { type: 'number', unit: 'token' },
      },
    })
    const multiSummary = getDynamicPricingSummary(
      multiFieldModel,
      summaryOptions
    )
    if (!multiSummary) expect.fail('Expected multiSummary to be present')
    expect(multiSummary.primaryEntries.length).toBe(2)
    expect(
      multiSummary.primaryEntries.every((entry) => entry.labelKind === 'schema')
    ).toBeTruthy()

    const chatSummary = getDynamicPricingSummary(
      pricingModel({
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("base", p * 2 + c * 8)',
      }),
      summaryOptions
    )
    if (!chatSummary) expect.fail('Expected chatSummary to be present')
    expect(
      chatSummary.primaryEntries.every((entry) => entry.labelKind === 'i18n')
    ).toBeTruthy()
  })

  test('returns the first evaluated usage example for a canonical task expression', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("tokens") * 9.8 / 1000000)',
      billing_usage_schema: {
        tokens: { type: 'number', unit: 'token' },
      },
      billing_usage_examples: [
        { label: '720p · 5s', facts: { tokens: 108000 } },
        { label: '1080p · 5s', facts: { tokens: 243000 } },
      ],
    })

    const example = getCardExamplePrice(model, summaryOptions)

    if (!example) expect.fail('Expected example to be present')
    expect(example.label).toBe('720p · 5s')
    expect(example.formatted).toMatch(/1[.,]0584/)
  })

  test('returns null when the expression is not canonical or examples are missing', () => {
    const schema = {
      tokens: { type: 'number' as const, unit: 'token' as const },
    }
    const examples = [{ label: '720p · 5s', facts: { tokens: 108000 } }]

    expect(
      getCardExamplePrice(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'u("tokens") * 0.00007 * (u("tokens") > 100000 ? 0.8 : 1)',
          billing_usage_schema: schema,
          billing_usage_examples: examples,
        }),
        summaryOptions
      )
    ).toBe(null)
    expect(
      getCardExamplePrice(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("tokens") * 9.8 / 1000000)',
          billing_usage_schema: schema,
        }),
        summaryOptions
      )
    ).toBe(null)
    expect(getCardExamplePrice(pricingModel({}), summaryOptions)).toBe(null)
  })
})
