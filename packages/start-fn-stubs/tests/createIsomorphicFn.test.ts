import { describe, expect, it } from 'vitest'
import { createIsomorphicFn } from '../src/createIsomorphicFn'

describe('createIsomorphicFn runtime fallback', () => {
  it('returns a callable server implementation', () => {
    const fn = createIsomorphicFn().server(() => 'server')

    expect(fn()).toBe('server')
  })

  it('prefers the server implementation when both implementations are registered', () => {
    const fn = createIsomorphicFn()
      .server(() => 'server')
      .client(() => 'client')

    expect(fn()).toBe('server')
  })

  it('returns a callable client-only implementation', () => {
    const fn = createIsomorphicFn().client(() => 'client')

    expect(fn()).toBe('client')
  })
})
