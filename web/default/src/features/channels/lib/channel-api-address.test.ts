import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { formatChannelApiAddress } from './channel-api-address'

describe('channel API address formatting', () => {
  test('returns null for empty channel base URLs', () => {
    assert.equal(formatChannelApiAddress(null), null)
    assert.equal(formatChannelApiAddress(undefined), null)
    assert.equal(formatChannelApiAddress('   '), null)
  })

  test('trims visible API addresses and uses the same value as the link target', () => {
    assert.deepEqual(formatChannelApiAddress('  https://api.example.com  '), {
      displayText: 'https://api.example.com',
      href: 'https://api.example.com',
    })
  })

  test('does not create link targets for non-http API addresses', () => {
    assert.deepEqual(formatChannelApiAddress('javascript:alert(1)'), {
      displayText: 'javascript:alert(1)',
      href: null,
    })
  })
})
