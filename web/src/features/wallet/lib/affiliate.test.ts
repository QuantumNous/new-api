import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { shouldShowAffiliateRewards } from './affiliate.ts'

describe('wallet affiliate rewards visibility', () => {
  test('shows rewards only when backend explicitly enables them', () => {
    assert.equal(shouldShowAffiliateRewards(true), true)
    assert.equal(shouldShowAffiliateRewards(false), false)
    assert.equal(shouldShowAffiliateRewards(undefined), false)
  })
})
