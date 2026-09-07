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

import { describe, test } from 'vitest'

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

describe('task dynamic pricing', () => {
  test('treats task coefficients as dollars per unit without a token divisor', () => {
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

    assert.ok(summary)
    assert.equal(summary.isTaskUsage, true)
    assert.equal(summary.isSpecialExpression, false)
    assert.equal(summary.tier?.label, 'std')
    assert.equal(summary.primaryEntries[0]?.value, 0.4)
    assert.equal(summary.primaryEntries[0]?.unit, 'second')
    assert.match(summary.primaryEntries[0]?.formatted ?? '', /0[.,]4/)
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

    assert.ok(summary)
    assert.equal(summary.isSpecialExpression, true)
    assert.equal(summary.tiers.length, 0)
  })

  test('summarizes different task tier prices as a range while preserving the fallback price', () => {
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

    assert.ok(summary)
    assert.match(summary.primaryEntries[0]?.formattedRange ?? '', /0[.,]4/)
    assert.match(summary.primaryEntries[0]?.formattedRange ?? '', /0[.,]8/)
    assert.match(summary.primaryEntries[0]?.formattedRange ?? '', /\S – \S/)
    assert.match(summary.primaryEntries[0]?.formatted ?? '', /0[.,]4/)
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

    assert.ok(summary)
    assert.equal(summary.primaryEntries[0]?.formattedRange, undefined)
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

    assert.equal(hasTaskUsageSchema(secondsModel), true)
    assert.equal(isUnconfiguredTaskUsageModel(secondsModel), true)
    assert.equal(getDynamicPricingSummary(secondsModel, summaryOptions), null)
    assert.equal(getBillingModeLabelKey(secondsModel), 'Task billing')
    assert.equal(getBillingModeLabelKey(countModel), 'Task billing')
  })

  test('does not mark configured task usage pricing as unconfigured', () => {
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("seconds") * 0.4)',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })

    assert.equal(isUnconfiguredTaskUsageModel(model), false)
    assert.ok(getDynamicPricingSummary(model, summaryOptions))
  })

  test('leaves fixed per-request pricing configured when a usage schema is present', () => {
    const model = pricingModel({
      quota_type: 1,
      model_price: 0.5,
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
      },
    })

    assert.equal(isUnconfiguredTaskUsageModel(model), false)
    assert.equal(getDynamicPricingSummary(model, summaryOptions), null)
    assert.equal(isTokenBasedModel(model), false)
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

    assert.ok(summary)
    const tokenEntry = summary.primaryEntries[0]
    assert.ok(tokenEntry)
    assert.equal(tokenEntry.unit, 'token')
    assert.equal(tokenEntry.value, 9.8)
    assert.equal(getDynamicPriceUnitLabelKey(tokenEntry), '1M token')
    assert.equal(getTaskUsagePriceUnitLabelKey('token'), '1M token')
    assert.equal(
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
      }),
      null
    )
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

    assert.ok(summary)
    const creditEntry = summary.primaryEntries[0]
    assert.ok(creditEntry)
    assert.equal(creditEntry.unit, 'credit')
    assert.equal(creditEntry.value, 0.14)
    assert.equal(getDynamicPriceUnitLabelKey(creditEntry), 'credit')
    assert.equal(getTaskUsagePriceUnitLabelKey('credit'), 'credit')
  })

  test('leaves token models without a usage schema unchanged', () => {
    const model = pricingModel({})

    assert.equal(hasTaskUsageSchema(model), false)
    assert.equal(isUnconfiguredTaskUsageModel(model), false)
    assert.equal(getBillingModeLabelKey(model), 'Token-based')
  })

  test('preserves all billing-mode badge states', () => {
    assert.equal(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("seconds") * 0.4)',
          billing_usage_schema: {
            seconds: { type: 'number', unit: 'second' },
          },
        })
      ),
      'Task billing'
    )
    assert.equal(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("clips") * 0.05)',
          billing_usage_schema: {
            clips: { type: 'number', unit: 'count' },
          },
        })
      ),
      'Task billing'
    )
    assert.equal(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("tokens") * 9.8 / 1000000)',
          billing_usage_schema: {
            tokens: { type: 'number', unit: 'token' },
          },
        })
      ),
      'Task billing'
    )
    assert.equal(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("units") * 0.14)',
          billing_usage_schema: {
            units: { type: 'number', unit: 'credit' },
          },
        })
      ),
      'Task billing'
    )
    assert.equal(
      getBillingModeLabelKey(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", p * 2 + c * 8)',
        })
      ),
      'Dynamic Pricing'
    )
    assert.equal(getBillingModeLabelKey(pricingModel({})), 'Token-based')
    assert.equal(
      getBillingModeLabelKey(pricingModel({ quota_type: 1 })),
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
    assert.ok(tokenSummary)
    assert.equal(tokenSummary.primaryEntries[0]?.shortLabel, 'tokens')
    assert.equal(tokenSummary.primaryEntries[0]?.labelKind, 'schema')
    assert.equal(tokenSummary.secondaryEntries[0]?.shortLabel, 'Base')
    assert.equal(tokenSummary.secondaryEntries[0]?.labelKind, 'i18n')

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
    assert.ok(multiSummary)
    assert.equal(multiSummary.primaryEntries.length, 2)
    assert.ok(
      multiSummary.primaryEntries.every((entry) => entry.labelKind === 'schema')
    )

    const chatSummary = getDynamicPricingSummary(
      pricingModel({
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("base", p * 2 + c * 8)',
      }),
      summaryOptions
    )
    assert.ok(chatSummary)
    assert.ok(
      chatSummary.primaryEntries.every((entry) => entry.labelKind === 'i18n')
    )
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

    assert.ok(example)
    assert.equal(example.label, '720p · 5s')
    assert.match(example.formatted, /1[.,]0584/)
  })

  test('returns null when the expression is not canonical or examples are missing', () => {
    const schema = {
      tokens: { type: 'number' as const, unit: 'token' as const },
    }
    const examples = [{ label: '720p · 5s', facts: { tokens: 108000 } }]

    assert.equal(
      getCardExamplePrice(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'u("tokens") * 0.00007 * (u("tokens") > 100000 ? 0.8 : 1)',
          billing_usage_schema: schema,
          billing_usage_examples: examples,
        }),
        summaryOptions
      ),
      null
    )
    assert.equal(
      getCardExamplePrice(
        pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("tokens") * 9.8 / 1000000)',
          billing_usage_schema: schema,
        }),
        summaryOptions
      ),
      null
    )
    assert.equal(getCardExamplePrice(pricingModel({}), summaryOptions), null)
  })
})
