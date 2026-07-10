import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { Route } from './token'

describe('legacy token route compatibility', () => {
  test('redirects /console/token to /keys and preserves search parameters', () => {
    const beforeLoad = Route.options.beforeLoad
    assert.ok(beforeLoad)

    const search = { token: 'legacy-key', page: '2' }
    assert.throws(
      () => beforeLoad({ search } as never),
      (error: unknown) => {
        assert.ok(error && typeof error === 'object' && 'options' in error)
        const options = error.options as {
          search?: Record<string, unknown>
          to?: string
        }
        assert.equal(options.to, '/keys')
        assert.deepEqual(options.search, search)
        return true
      }
    )
  })
})
