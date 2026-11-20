import { describe, expect, test } from 'vitest'
import { retainSearchParams, stripSearchParams } from '../src/searchMiddleware'

describe('searchMiddleware - mutation prevention', () => {
  describe('retainSearchParams', () => {
    test('should not mutate original search object', () => {
      const originalSearch = { id: '1', filter: 'active', page: '2' }
      const originalCopy = { ...originalSearch }

      const middleware = retainSearchParams(['id', 'filter'])

      // next() returns object without 'id' and 'filter' keys
      // so retainSearchParams should add them from search
      const result = middleware({
        search: originalSearch,
        next: () =>
          ({
            search: { page: 'new' },
            meta: {},
          }) as any,
      })

      expect(originalSearch).toEqual(originalCopy)
      expect(originalSearch).toEqual({ id: '1', filter: 'active', page: '2' })
      expect(result).toEqual({ id: '1', filter: 'active', page: 'new' })
      expect(result).not.toBe(originalSearch)
    })

    test('should work correctly when same reference is reused', () => {
      const sharedSearch = { id: '1', filter: 'active', page: '1' }
      const middleware = retainSearchParams(['id', 'filter'])

      // next() returns object without 'id' and 'filter' keys
      const result1 = middleware({
        search: sharedSearch,
        next: () =>
          ({
            search: { page: '2' },
            meta: {},
          }) as any,
      })

      expect(sharedSearch).toEqual({ id: '1', filter: 'active', page: '1' })
      expect(result1).toEqual({ id: '1', filter: 'active', page: '2' })

      const result2 = middleware({
        search: sharedSearch,
        next: () =>
          ({
            search: { page: '3' },
            meta: {},
          }) as any,
      })

      expect(sharedSearch).toEqual({ id: '1', filter: 'active', page: '1' })
      expect(result2).toEqual({ id: '1', filter: 'active', page: '3' })
    })

    test('should handle retainSearchParams(true) correctly', () => {
      const originalSearch = { id: '1', filter: 'active' }
      const originalCopy = { ...originalSearch }

      const middleware = retainSearchParams(true)

      const result = middleware({
        search: originalSearch,
        next: () =>
          ({
            search: { id: '2' },
            meta: {},
          }) as any,
      })

      expect(originalSearch).toEqual(originalCopy)
      expect(result).toEqual({ id: '2', filter: 'active' })
    })
  })

  describe('stripSearchParams', () => {
    test('should not mutate original search object (array input)', () => {
      const originalSearch = { id: '1', filter: 'active', page: '1' }
      const originalCopy = { ...originalSearch }

      const middleware = stripSearchParams(['filter', 'page'])

      const result = middleware({
        search: originalSearch,
        next: (search) => search,
      })

      expect(originalSearch).toEqual(originalCopy)
      expect(originalSearch).toEqual({ id: '1', filter: 'active', page: '1' })
      expect(result).toEqual({ id: '1' })
      expect(result).not.toBe(originalSearch)
    })

    test('should not mutate original search object (object input)', () => {
      const originalSearch = { id: '1', filter: 'active', status: 'done' }
      const originalCopy = { ...originalSearch }

      const middleware = stripSearchParams({ filter: 'active', status: 'done' })

      const result = middleware({
        search: originalSearch,
        next: (search) => search,
      })

      expect(originalSearch).toEqual(originalCopy)
      expect(originalSearch).toEqual({
        id: '1',
        filter: 'active',
        status: 'done',
      })
      expect(result).toEqual({ id: '1' })
      expect(result).not.toBe(originalSearch)
    })

    test('should work correctly when same reference is reused', () => {
      const sharedSearch = { id: '1', filter: 'active', page: '1' }
      const middleware = stripSearchParams(['filter', 'page'])

      const result1 = middleware({
        search: sharedSearch,
        next: (search) => search,
      })

      expect(sharedSearch).toEqual({ id: '1', filter: 'active', page: '1' })
      expect(result1).toEqual({ id: '1' })

      const result2 = middleware({
        search: sharedSearch,
        next: (search) => search,
      })

      expect(sharedSearch).toEqual({ id: '1', filter: 'active', page: '1' })
      expect(result2).toEqual({ id: '1' })
    })

    test('should handle stripSearchParams(true) correctly', () => {
      const originalSearch = { id: '1', filter: 'active' }
      const originalCopy = { ...originalSearch }

      const middleware = stripSearchParams(true)

      const result = middleware({
        search: originalSearch,
        next: (search) => search,
      })

      expect(originalSearch).toEqual(originalCopy)
      expect(result).toEqual({})
    })
  })
})
