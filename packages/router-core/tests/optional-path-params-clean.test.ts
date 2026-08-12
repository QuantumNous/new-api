import { describe, expect, it } from 'vitest'
import { interpolatePath } from '../src/path'
import {
  SEGMENT_TYPE_OPTIONAL_PARAM,
  SEGMENT_TYPE_PATHNAME,
  findSingleMatch,
  parseSegment,
  processRouteTree,
} from '../src/new-process-route-tree'
import type { SegmentKind } from '../src/new-process-route-tree'

describe('Optional Path Parameters - Clean Comprehensive Tests', () => {
  describe('Optional Dynamic Parameters {-$param}', () => {
    describe('parsePathname', () => {
      type PathSegment = {
        type: SegmentKind
        value: string
        prefixSegment?: string
        suffixSegment?: string
        // Indicates if there is a static segment after this required/optional param
        hasStaticAfter?: boolean
      }

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

      it('should parse single optional dynamic param', () => {
        const result = parsePathname('/posts/{-$category}')
        expect(result).toEqual([
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'posts' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'category' },
        ])
      })

      it('should parse multiple optional dynamic params', () => {
        const result = parsePathname('/posts/{-$category}/{-$slug}')
        expect(result).toEqual([
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'posts' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'category' },
          { type: SEGMENT_TYPE_OPTIONAL_PARAM, value: 'slug' },
        ])
      })

      it('should handle prefix/suffix with optional dynamic params', () => {
        const result = parsePathname('/api/v{-$version}/data')
        expect(result).toEqual([
          { type: SEGMENT_TYPE_PATHNAME, value: '' },
          { type: SEGMENT_TYPE_PATHNAME, value: 'api' },
          {
            type: SEGMENT_TYPE_OPTIONAL_PARAM,
            value: 'version',
            prefixSegment: 'v',
            suffixSegment: undefined,
          },
          { type: SEGMENT_TYPE_PATHNAME, value: 'data' },
        ])
      })
    })

    describe('interpolatePath', () => {
      it('should interpolate optional dynamic params when present', () => {
        const result = interpolatePath({
          path: '/posts/{-$category}',
          params: { category: 'tech' },
        })
        expect(result.interpolatedPath).toBe('/posts/tech')
      })

      it('should omit optional dynamic params when missing', () => {
        const result = interpolatePath({
          path: '/posts/{-$category}',
          params: {},
        })
        expect(result.interpolatedPath).toBe('/posts')
      })

      it('should handle multiple optional dynamic params', () => {
        const result1 = interpolatePath({
          path: '/posts/{-$category}/{-$slug}',
          params: { category: 'tech', slug: 'hello' },
        })
        expect(result1.interpolatedPath).toBe('/posts/tech/hello')

        const result2 = interpolatePath({
          path: '/posts/{-$category}/{-$slug}',
          params: { category: 'tech' },
        })
        expect(result2.interpolatedPath).toBe('/posts/tech')

        const result3 = interpolatePath({
          path: '/posts/{-$category}/{-$slug}',
          params: {},
        })
        expect(result3.interpolatedPath).toBe('/posts')
      })

      it('should handle mixed required and optional dynamic params', () => {
        const result = interpolatePath({
          path: '/posts/{-$category}/user/$id',
          params: { category: 'tech', id: '123' },
        })
        expect(result.interpolatedPath).toBe('/posts/tech/user/123')

        const result2 = interpolatePath({
          path: '/posts/{-$category}/user/$id',
          params: { id: '123' },
        })
        expect(result2.interpolatedPath).toBe('/posts/user/123')
      })
    })

    describe('matchPathname', () => {
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
      it('should match optional dynamic params when present', () => {
        const result = matchPathname('/posts/tech', {
          to: '/posts/{-$category}',
        })
        expect(result).toEqual({ category: 'tech' })
      })

      it('should match optional dynamic params when absent', () => {
        const result = matchPathname('/posts', {
          to: '/posts/{-$category}',
        })
        expect(result).toEqual({})
      })

      it('should handle multiple optional dynamic params', () => {
        const result1 = matchPathname('/posts/tech/hello', {
          to: '/posts/{-$category}/{-$slug}',
        })
        expect(result1).toEqual({ category: 'tech', slug: 'hello' })

        const result2 = matchPathname('/posts/tech', {
          to: '/posts/{-$category}/{-$slug}',
        })
        expect(result2).toEqual({ category: 'tech' })

        const result3 = matchPathname('/posts', {
          to: '/posts/{-$category}/{-$slug}',
        })
        expect(result3).toEqual({})
      })

      it('should handle mixed required and optional dynamic params', () => {
        const result1 = matchPathname('/posts/tech/user/123', {
          to: '/posts/{-$category}/user/$id',
        })
        expect(result1).toEqual({ category: 'tech', id: '123' })

        const result2 = matchPathname('/posts/user/123', {
          to: '/posts/{-$category}/user/$id',
        })
        expect(result2).toEqual({ id: '123' })
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle optional params with wildcards', () => {
      const result = interpolatePath({
        path: '/docs/{-$version}/$',
        params: { version: 'v1', _splat: 'guide/intro' },
      })
      expect(result.interpolatedPath).toBe('/docs/v1/guide/intro')

      const result2 = interpolatePath({
        path: '/docs/{-$version}/$',
        params: { _splat: 'guide/intro' },
      })
      expect(result2.interpolatedPath).toBe('/docs/guide/intro')
    })

    it('should work with complex patterns', () => {
      const pattern = '/app/{-$env}/api/{-$version}/users/$id/{-$tab}'

      // All params provided
      const result1 = interpolatePath({
        path: pattern,
        params: { env: 'prod', version: 'v2', id: '123', tab: 'settings' },
      })
      expect(result1.interpolatedPath).toBe(
        '/app/prod/api/v2/users/123/settings',
      )

      // Only required param
      const result2 = interpolatePath({
        path: pattern,
        params: { id: '123' },
      })
      expect(result2.interpolatedPath).toBe('/app/api/users/123')

      // Mix of optional and required
      const result3 = interpolatePath({
        path: pattern,
        params: { env: 'dev', id: '456', tab: 'profile' },
      })
      expect(result3.interpolatedPath).toBe('/app/dev/api/users/456/profile')
    })
  })
})
