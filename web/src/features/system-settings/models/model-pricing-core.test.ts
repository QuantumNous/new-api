import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildModelPricingOptionUpdates } from './model-pricing-core'

describe('model pricing option updates', () => {
  test('uses per-token fields when switching away from stale per-request price', () => {
    const updates = buildModelPricingOptionUpdates({
      current: {
        modelPrice: JSON.stringify({ 'gpt-test': 0.01 }),
        modelRatio: '{}',
        cacheRatio: '{}',
        createCacheRatio: '{}',
        completionRatio: '{}',
        imageRatio: '{}',
        audioRatio: '{}',
        audioCompletionRatio: '{}',
        billingMode: JSON.stringify({ 'gpt-test': 'tiered_expr' }),
        billingExpr: JSON.stringify({ 'gpt-test': 'tier("old", p)' }),
      },
      data: {
        name: 'gpt-test',
        billingMode: 'per-token',
        price: '0.01',
        ratio: '1.5',
        completionRatio: '2',
      },
    })

    assert.deepEqual(JSON.parse(updates.ModelPrice), {})
    assert.deepEqual(JSON.parse(updates.ModelRatio), { 'gpt-test': 1.5 })
    assert.deepEqual(JSON.parse(updates.CompletionRatio), { 'gpt-test': 2 })
    assert.deepEqual(JSON.parse(updates['billing_setting.billing_mode']), {})
    assert.deepEqual(JSON.parse(updates['billing_setting.billing_expr']), {})
  })

  test('uses per-request price when switching away from stale token ratios', () => {
    const updates = buildModelPricingOptionUpdates({
      current: {
        modelPrice: '{}',
        modelRatio: JSON.stringify({ 'gpt-test': 1.5 }),
        cacheRatio: '{}',
        createCacheRatio: '{}',
        completionRatio: JSON.stringify({ 'gpt-test': 2 }),
        imageRatio: '{}',
        audioRatio: '{}',
        audioCompletionRatio: '{}',
        billingMode: '{}',
        billingExpr: '{}',
      },
      data: {
        name: 'gpt-test',
        billingMode: 'per-request',
        price: '0.01',
        ratio: '1.5',
        completionRatio: '2',
      },
    })

    assert.deepEqual(JSON.parse(updates.ModelPrice), { 'gpt-test': 0.01 })
    assert.deepEqual(JSON.parse(updates.ModelRatio), {})
    assert.deepEqual(JSON.parse(updates.CompletionRatio), {})
  })

  test('keeps fallback price and token ratios when switching into tiered expression mode', () => {
    const updates = buildModelPricingOptionUpdates({
      current: {
        modelPrice: JSON.stringify({ 'gpt-test': 0.01 }),
        modelRatio: JSON.stringify({ 'gpt-test': 1.5 }),
        cacheRatio: '{}',
        createCacheRatio: '{}',
        completionRatio: JSON.stringify({ 'gpt-test': 2 }),
        imageRatio: '{}',
        audioRatio: '{}',
        audioCompletionRatio: '{}',
        billingMode: '{}',
        billingExpr: '{}',
      },
      data: {
        name: 'gpt-test',
        billingMode: 'tiered_expr',
        price: '0.02',
        ratio: '2',
        completionRatio: '3',
        billingExpr: 'tier("base", p * 0 + c * 0)',
      },
    })

    assert.deepEqual(JSON.parse(updates.ModelPrice), { 'gpt-test': 0.02 })
    assert.deepEqual(JSON.parse(updates.ModelRatio), { 'gpt-test': 2 })
    assert.deepEqual(JSON.parse(updates.CompletionRatio), { 'gpt-test': 3 })
    assert.deepEqual(JSON.parse(updates['billing_setting.billing_mode']), {
      'gpt-test': 'tiered_expr',
    })
    assert.deepEqual(JSON.parse(updates['billing_setting.billing_expr']), {
      'gpt-test': 'tier("base", p * 0 + c * 0)',
    })
  })
})
