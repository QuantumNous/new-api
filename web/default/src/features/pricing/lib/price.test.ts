import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  calculateOfficialSavings,
  formatSavingsPercent,
} from './price'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'gpt-5.5',
    quota_type: 0,
    model_ratio: 2.5,
    completion_ratio: 6,
    enable_groups: ['gpt pro'],
    group_ratio: { 'gpt pro': 0.2 },
    ...overrides,
  }
}

describe('calculateOfficialSavings', () => {
  test('compares grouped RMB price against official USD price converted to RMB', () => {
    const savings = calculateOfficialSavings(pricingModel({}), {
      usdExchangeRate: 1,
      officialUsdExchangeRate: 8,
    })

    assert.equal(savings?.group, 'gpt pro')
    assert.equal(savings?.groupRatio, 0.2)
    assert.equal(formatSavingsPercent(savings?.percent ?? 0), '97.5')
  })

  test('uses the cheapest enabled group for model square savings', () => {
    const savings = calculateOfficialSavings(
      pricingModel({
        model_name: 'claude-sonnet-4-6',
        model_ratio: 1.5,
        completion_ratio: 5,
        enable_groups: ['cc max', 'c antigravity'],
        group_ratio: {
          'cc max': 1.8,
          'c antigravity': 0.5,
        },
      }),
      {
        usdExchangeRate: 1,
        officialUsdExchangeRate: 8,
      }
    )

    assert.equal(savings?.group, 'c antigravity')
    assert.equal(savings?.groupRatio, 0.5)
    assert.equal(formatSavingsPercent(savings?.percent ?? 0), '93.75')
  })

  test('handles per-request models with the same currency conversion rule', () => {
    const savings = calculateOfficialSavings(
      pricingModel({
        model_name: 'gpt-image-2',
        quota_type: 1,
        model_ratio: 0,
        completion_ratio: 0,
        model_price: 0.25,
        enable_groups: ['gpt pro'],
        group_ratio: { 'gpt pro': 0.2 },
      }),
      {
        usdExchangeRate: 1,
        officialUsdExchangeRate: 8,
      }
    )

    assert.equal(savings?.group, 'gpt pro')
    assert.equal(formatSavingsPercent(savings?.percent ?? 0), '97.5')
  })

  test('returns no badge when no positive savings exist', () => {
    const savings = calculateOfficialSavings(
      pricingModel({
        enable_groups: ['standard'],
        group_ratio: { standard: 1 },
      }),
      {
        usdExchangeRate: 8,
        officialUsdExchangeRate: 8,
      }
    )

    assert.equal(savings, null)
  })
})
