import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { DEFAULT_LOGO } from '../lib/constants.ts'
import { normalizeSystemLogo } from './system-config.ts'

describe('normalizeSystemLogo', () => {
  test('uses the bundled aiapi114 logo when the API returns the legacy favicon URL', () => {
    assert.equal(
      normalizeSystemLogo('https://aiapi114.com/aiapi-favorite.ico'),
      DEFAULT_LOGO,
    )
    assert.equal(
      normalizeSystemLogo('https://www.aiapi114.com/aiapi-favorite.ico'),
      DEFAULT_LOGO,
    )
  })
})
