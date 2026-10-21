import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingModel } from '../types'
import { matchesCapabilityTab, CAPABILITY_TABS } from './capabilities'

function model(tags: string): PricingModel {
  return {
    id: 1,
    model_name: 'm',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
    tags,
  } as PricingModel
}

describe('matchesCapabilityTab', () => {
  test('all tab matches everything', () => {
    assert.equal(matchesCapabilityTab(model(''), 'all'), true)
  })
  test('text tab matches chat tag', () => {
    assert.equal(matchesCapabilityTab(model('chat'), 'text'), true)
  })
  test('code tab matches code tag', () => {
    assert.equal(matchesCapabilityTab(model('code,chat'), 'code'), true)
  })
  test('multimodal tab matches vision tag', () => {
    assert.equal(matchesCapabilityTab(model('vision'), 'multimodal'), true)
  })
  test('image tab matches image tag', () => {
    assert.equal(matchesCapabilityTab(model('image'), 'image'), true)
  })
  test('video tab matches video tag', () => {
    assert.equal(matchesCapabilityTab(model('video'), 'video'), true)
  })
  test('text tab does not match pure image model', () => {
    assert.equal(matchesCapabilityTab(model('image'), 'text'), false)
  })
  test('exposes 6 tabs', () => {
    assert.deepEqual(
      CAPABILITY_TABS.map((t) => t.value),
      ['all', 'text', 'code', 'multimodal', 'image', 'video']
    )
  })
})
