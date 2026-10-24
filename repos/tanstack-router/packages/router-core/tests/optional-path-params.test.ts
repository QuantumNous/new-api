import { describe, expect, it } from 'vitest'
import { interpolatePath } from '../src/path'
import {
  SEGMENT_TYPE_OPTIONAL_PARAM,
  SEGMENT_TYPE_PARAM,
  SEGMENT_TYPE_PATHNAME,
  SEGMENT_TYPE_WILDCARD,
  findSingleMatch,
  parseSegment,
  processRouteTree,
} from '../src/new-process-route-tree'
import type { SegmentKind } from '../src/new-process-route-tree'

describe('Optional Path Parameters', () => {
  type PathSegment = {
    type: SegmentKind
    value: string
    prefixSegment?: string
    suffixSegment?: string
  }
  type ParsePathnameTestScheme = Array<{
    name: string
    to: string | undefined
    expected: Array<PathSegment>
  }>

  describe('parsePathname with optional params', () => {
    const parsePathname = (to: string | undefined) => {
      let cursor = 0
      let data
      const path = to ?? ''
      const segments: Array<PathSegment> = []
      while (cursor < path.length) {
        const start = cursor
        data = parseSegment(path, start, data)
        const end = data[5]
        cursor = end + 1
        const type = data[0]
        const value = path.substring(data[2], data[3])
        const prefix = path.substring(start, data[1])
        const suffix = path.substring(data[4], end)
        const segment: PathSegment = {
          type,
          value,
        }
        if (prefix) {
          segment.prefixSegment = prefix
        }
        if (suffix) {
          segment.suffixSegment = suffix
        }
        segments.push(segment)
      }
      return segments
    }
    it.each([
      {
        name: 'regular optional param',
        to: '/{-$slug}',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'slug' },
        ],
      },
      {
        name: 'optional param with prefix',
        to: '/prefix{-$slug}',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          {
            type: SEGMENT_TYPE_OPTIONAL_PARAM,
            value: 'slug',
            prefixSegment: 'prefix',
          },
        ],
      },
      {
        name: 'optional param with suffix',
        to: '/{-$slug}suffix',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          {
            type: SEGMENT_TYPE_OPTIONAL_PARAM,
            value: 'slug',
            suffixSegment: 'suffix',
          },
        ],
      },
      {
        name: 'optional param with prefix and suffix',
        to: '/prefix{-$slug}suffix',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          {
            type: SEGMENT_TYPE_OPTIONAL_PARAM,
            value: 'slug',
            prefixSegment: 'prefix',
            suffixSegment: 'suffix',
          },
        ],
      },
      {
        name: 'multiple optional params',
        to: '/posts/{-$category}/{-$slug}',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'posts' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'category' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'slug' },
        ],
      },
      {
        name: 'mixed required and optional params',
        to: '/users/$id/{-$tab}',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'users' },
          { type: SEGMENT_TYPE_PARAM, value: 'id' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'tab' },
        ],
      },
      {
        name: 'optional param followed by required param',
        to: '/{-$category}/$slug',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'category' },
          { type: SEGMENT_TYPE_PARAM, value: 'slug' },
        ],
      },
      {
        name: 'optional param with wildcard',
        to: '/docs/{-$version}/$',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'docs' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'version' },
          { type: SEGMENT_TYPE_WILDCARD, value: '$' },
        ],
      },
      {
        name: 'complex path with all param types',
        to: '/api/{-$version}/users/$id/{-$tab}/$',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'api' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'version' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'users' },
          { type: SEGMENT_TYPE_PARAM, value: 'id' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'tab' },
          { type: SEGMENT_TYPE_WILDCARD, value: '$' },
        ],
      },
      {
        name: 'optional param at root',
        to: '/{-$slug}',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'slug' },
        ],
      },
      {
        name: 'multiple consecutive optional params',
        to: '/{-$year}/{-$month}/{-$day}',
        expected: [
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'year' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'month' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'day' },
        ],
      },
    ] satisfies ParsePathnameTestScheme)('$name', ({ to, expected }) => {
      const result = parsePathname(to)
      expect(result).toEqual(expected)
    })
  })

  describe('interpolatePath with optional params', () => {
    it.each([
      {
        name: 'optional param provided',
        path: '/posts/{-$category}',
        params: { category: 'tech' },
        result: '/posts/tech',
      },
      {
        name: 'optional param omitted',
        path: '/posts/{-$category}',
        params: {},
        result: '/posts',
      },
      {
        name: 'optional param with undefined value',
        path: '/posts/{-$category}',
        params: { category: undefined },
        result: '/posts',
      },
      {
        name: 'optional param with prefix - provided',
        path: '/posts/prefix{-$category}',
        params: { category: 'tech' },
        result: '/posts/prefixtech',
      },
      {
        name: 'optional param with prefix - omitted',
        path: '/posts/prefix{-$category}',
        params: {},
        result: '/posts',
      },
      {
        name: 'optional param with prefix - empty string',
        path: '/posts/prefix{-$category}',
        params: { category: '' },
        result: '/posts/prefix',
      },
      {
        name: 'optional param with suffix - provided',
        path: '/posts/{-$category}.html',
        params: { category: 'tech' },
        result: '/posts/tech.html',
      },
      {
        name: 'optional param with suffix - omitted',
        path: '/posts/{-$category}.html',
        params: {},
        result: '/posts',
      },
      {
        name: 'optional param with suffix - empty string',
        path: '/posts/{-$category}.html',
        params: { category: '' },
        result: '/posts/.html',
      },
      {
        name: 'optional param with prefix and suffix - provided',
        path: '/posts/prefix{-$category}suffix',
        params: { category: 'tech' },
        result: '/posts/prefixtechsuffix',
      },
      {
        name: 'optional param with prefix and suffix - omitted',
        path: '/posts/prefix{-$category}suffix',
        params: {},
        result: '/posts',
      },
      {
        name: 'optional param with prefix and suffix - empty string',
        path: '/posts/prefix{-$category}suffix',
        params: { category: '' },
        result: '/posts/prefixsuffix',
      },
      {
        name: 'multiple optional params - all provided',
        path: '/posts/{-$category}/{-$slug}',
        params: { category: 'tech', slug: 'hello-world' },
        result: '/posts/tech/hello-world',
      },
      {
        name: 'multiple optional params - partially provided',
        path: '/posts/{-$category}/{-$slug}',
        params: { category: 'tech' },
        result: '/posts/tech',
      },
      {
        name: 'multiple optional params - none provided',
        path: '/posts/{-$category}/{-$slug}',
        params: {},
        result: '/posts',
      },
      {
        name: 'mixed required and optional params - all provided',
        path: '/users/$id/{-$tab}',
        params: { id: '123', tab: 'settings' },
        result: '/users/123/settings',
      },
      {
        name: 'mixed required and optional params - optional omitted',
        path: '/users/$id/{-$tab}',
        params: { id: '123' },
        result: '/users/123',
      },
      {
        name: 'optional param between required params',
        path: '/users/$id/{-$section}/edit',
        params: { id: '123', section: 'profile' },
        result: '/users/123/profile/edit',
      },
      {
        name: 'optional param between required params - omitted',
        path: '/users/$id/{-$section}/edit',
        params: { id: '123' },
        result: '/users/123/edit',
      },
      {
        name: 'complex path with all param types - all provided',
        path: '/api/{-$version}/users/$id/{-$tab}/$',
        params: {
          version: 'v2',
          id: '123',
          tab: 'settings',
          _splat: 'extra/path',
        },
        result: '/api/v2/users/123/settings/extra/path',
      },
      {
        name: 'complex path with all param types - optionals omitted',
        path: '/api/{-$version}/users/$id/{-$tab}/$',
        params: { id: '123', _splat: 'extra/path' },
        result: '/api/users/123/extra/path',
      },
      {
        name: 'multiple consecutive optional params - all provided',
        path: '/{-$year}/{-$month}/{-$day}',
        params: { year: '2023', month: '12', day: '25' },
        result: '/2023/12/25',
      },
      {
        name: 'multiple consecutive optional params - partially provided',
        path: '/{-$year}/{-$month}/{-$day}',
        params: { year: '2023', month: '12' },
        result: '/2023/12',
      },
      {
        name: 'multiple consecutive optional params - first only',
        path: '/{-$year}/{-$month}/{-$day}',
        params: { year: '2023' },
        result: '/2023',
      },
      {
        name: 'multiple consecutive optional params - none provided',
        path: '/{-$year}/{-$month}/{-$day}',
        params: {},
        result: '/',
      },
      {
        name: 'optional param with special characters',
        path: '/posts/{-$category}',
        params: { category: 'tech & science' },
        result: '/posts/tech%20%26%20science',
      },
      {
        name: 'optional param with number',
        path: '/posts/{-$page}',
        params: { page: 42 },
        result: '/posts/42',
      },
    ])('$name', ({ path, params, result }) => {
      expect(interpolatePath({ path, params }).interpolatedPath).toBe(result)
    })
  })

  const { processedTree } = processRouteTree({
    id: '__root__',
    isRoot: true,
    fullPath: '/',
    path: '/',
  })
  const matchPathname = (
    from: string,
    options: { to: string; caseSensitive?: boolean; fuzzy?: boolean },
  ) => {
    const match = findSingleMatch(
      options.to,
      options.caseSensitive ?? false,
      options.fuzzy ?? false,
      from,
      processedTree,
    )
    const result = match ? match.rawParams : undefined
    if (options.to && !result) return
    return result ?? {}
  }

  describe('matchPathname with optional params', () => {
    it.each([
      {
        name: 'optional param present in URL',
        input: '/posts/tech',
        matchingOptions: { to: '/posts/{-$category}' },
        expectedMatchedParams: { category: 'tech' },
      },
      {
        name: 'optional param absent in URL',
        input: '/posts',
        matchingOptions: { to: '/posts/{-$category}' },
        expectedMatchedParams: {},
      },
      {
        name: 'multiple optional params - all present',
        input: '/posts/tech/hello-world',
        matchingOptions: { to: '/posts/{-$category}/{-$slug}' },
        expectedMatchedParams: { category: 'tech', slug: 'hello-world' },
      },
      {
        name: 'multiple optional params - partially present',
        input: '/posts/tech',
        matchingOptions: { to: '/posts/{-$category}/{-$slug}' },
        expectedMatchedParams: { category: 'tech' },
      },
      {
        name: 'multiple optional params - none present',
        input: '/posts',
        matchingOptions: { to: '/posts/{-$category}/{-$slug}' },
        expectedMatchedParams: {},
      },
      {
        name: 'mixed required and optional params - all present',
        input: '/users/123/settings',
        matchingOptions: { to: '/users/$id/{-$tab}' },
        expectedMatchedParams: { id: '123', tab: 'settings' },
      },
      {
        name: 'mixed required and optional params - optional absent',
        input: '/users/123',
        matchingOptions: { to: '/users/$id/{-$tab}' },
        expectedMatchedParams: { id: '123' },
      },
      {
        name: 'optional param with prefix and suffix - present',
        input: '/posts/prefixtech.html',
        matchingOptions: { to: '/posts/prefix{-$category}.html' },
        expectedMatchedParams: { category: 'tech' },
      },
      {
        name: 'optional param with prefix and suffix - absent',
        input: '/posts',
        matchingOptions: { to: '/posts/prefix{-$category}.html' },
        expectedMatchedParams: {},
      },
      {
        name: 'optional param between required segments',
        input: '/users/123/settings/edit',
        matchingOptions: { to: '/users/$id/{-$section}/edit' },
        expectedMatchedParams: { id: '123', section: 'settings' },
      },
      {
        name: 'optional param between required segments - omitted',
        input: '/users/123/edit',
        matchingOptions: { to: '/users/$id/{-$section}/edit' },
        expectedMatchedParams: { id: '123' },
      },
      {
        name: 'consecutive optional params - all present',
        input: '/2023/12/25',
        matchingOptions: { to: '/{-$year}/{-$month}/{-$day}' },
        expectedMatchedParams: { year: '2023', month: '12', day: '25' },
      },
      {
        name: 'consecutive optional params - partially present',
        input: '/2023/12',
        matchingOptions: { to: '/{-$year}/{-$month}/{-$day}' },
        expectedMatchedParams: { year: '2023', month: '12' },
      },
      {
        name: 'consecutive optional params - first only',
        input: '/2023',
        matchingOptions: { to: '/{-$year}/{-$month}/{-$day}' },
        expectedMatchedParams: { year: '2023' },
      },
      {
        name: 'consecutive optional params - none present',
        input: '/',
        matchingOptions: { to: '/{-$year}/{-$month}/{-$day}' },
        expectedMatchedParams: {},
      },
    ])('$name', ({ input, matchingOptions, expectedMatchedParams }) => {
      expect(matchPathname(input, matchingOptions)).toStrictEqual(
        toNullObj(expectedMatchedParams),
      )
    })
  })

  describe('edge cases', () => {
    it('should handle optional parameters with validation', () => {
      // This test will be expanded when we implement params.parse for optional params
      const path = '/posts/{-$category}'
      const params = { category: 'tech' }
      expect(interpolatePath({ path, params }).interpolatedPath).toBe(
        '/posts/tech',
      )
    })

    it('should handle multiple consecutive optional parameters correctly', () => {
      const tests = [
        { input: '/', pattern: '/{-$a}/{-$b}/{-$c}', expected: {} },
        { input: '/1', pattern: '/{-$a}/{-$b}/{-$c}', expected: { a: '1' } },
        {
          input: '/1/2',
          pattern: '/{-$a}/{-$b}/{-$c}',
          expected: { a: '1', b: '2' },
        },
        {
          input: '/1/2/3',
          pattern: '/{-$a}/{-$b}/{-$c}',
          expected: { a: '1', b: '2', c: '3' },
        },
      ]

      tests.forEach(({ input, pattern, expected }) => {
        expect(matchPathname(input, { to: pattern })).toEqual(expected)
      })
    })

    it('should prioritize more specific routes over optional param routes', () => {
      // Test that /posts/featured matches a static route, not optional param route
      const staticMatch = matchPathname('/posts/featured', {
        to: '/posts/featured',
      })
      const optionalMatch = matchPathname('/posts/featured', {
        to: '/posts/{-$category}',
      })

      expect(staticMatch).toEqual({})
      expect(optionalMatch).toEqual({ category: 'featured' })
    })

    it('should handle optional parameters with wildcards', () => {
      const input = '/docs/v2/extra/path'
      const pattern = '/docs/{-$version}/$'
      const expected = {
        version: 'v2',
        '*': 'extra/path',
        _splat: 'extra/path',
      }

      expect(matchPathname(input, { to: pattern })).toEqual(expected)
    })
  })
})

function toNullObj<T>(obj: T): T {
  if (typeof obj === 'object') return Object.assign(Object.create(null), obj)
  return obj
}
