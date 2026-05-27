import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('model status API request', () => {
  test('does not use global GET deduplication for live status refreshes', () => {
    const source = readFileSync('src/features/model-status/api.ts', 'utf8')

    assert.match(source, /disableDuplicate:\s*true/)
  })
})
