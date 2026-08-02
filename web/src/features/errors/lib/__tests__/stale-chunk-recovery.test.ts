import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  canReloadStaleChunk,
  isStaleChunkLoadError,
} from '../stale-chunk-recovery'

describe('isStaleChunkLoadError', () => {
  test('recognizes Rspack chunk load failures', () => {
    const error = new Error(
      'Loading chunk 837 failed. (missing: /static/js/async/837.old.js)'
    )
    error.name = 'ChunkLoadError'

    assert.equal(isStaleChunkLoadError(error), true)
  })

  test('recognizes browser dynamic import failures', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://example.com/chunk.js'
    )

    assert.equal(isStaleChunkLoadError(error), true)
  })

  test('does not treat API server errors as stale chunks', () => {
    const error = {
      message: 'Request failed with status code 500',
      response: { status: 500 },
    }

    assert.equal(isStaleChunkLoadError(error), false)
  })
})

describe('canReloadStaleChunk', () => {
  test('allows the first recovery reload', () => {
    assert.equal(canReloadStaleChunk(null, 120_000), true)
  })

  test('blocks another reload during the cooldown', () => {
    assert.equal(canReloadStaleChunk('90000', 120_000), false)
  })

  test('allows recovery again after the cooldown expires', () => {
    assert.equal(canReloadStaleChunk('1000', 120_000), true)
  })
})
