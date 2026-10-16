import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import { findRouteMatch, processRouteTree } from '../src/new-process-route-tree'
import { BaseRootRoute, BaseRoute, PathParamError } from '../src'
import { createTestRouter } from './routerTestUtils'

type TestRoute = {
  id: string
  fullPath: string
  path?: string
  isRoot?: boolean
  options?: {
    params?: {
      parse?: (params: Record<string, string>) => unknown
      priority?: number
    }
  }
  children?: Array<TestRoute>
}

const root = (children: Array<TestRoute>): TestRoute => ({
  id: '__root__',
  isRoot: true,
  fullPath: '/',
  path: '/',
  children,
})

const parseWhen = (predicate: (params: Record<string, string>) => boolean) => {
  return (params: Record<string, string>) =>
    predicate(params) ? params : false
}

const integerParse = (key: string) =>
  parseWhen((params) => {
    const value = Number(params[key])
    return Number.isInteger(value)
  })

describe('params.parse route selection', () => {
  describe('basic matching', () => {
    it('matches route when params.parse returns params', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse: integerParse('id'),
              },
            },
          },
        ]),
      )

      const result = findRouteMatch('/123', processedTree)
      expect(result?.route.id).toBe('/$id')
      expect(result?.rawParams).toEqual({ id: '123' })
    })

    it('skips route when params.parse returns false and finds no alternative', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse: integerParse('id'),
              },
            },
          },
        ]),
      )

      const result = findRouteMatch('/abc', processedTree)
      expect(result).toBeNull()
    })

    it('skips route when params.parse returns false and finds an alternative', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse: integerParse('id'),
              },
            },
          },
          {
            id: '/$slug',
            fullPath: '/$slug',
            path: '$slug',
          },
        ]),
      )

      const result = findRouteMatch('/hello-world', processedTree)
      expect(result?.route.id).toBe('/$slug')
      expect(result?.rawParams).toEqual({ slug: 'hello-world' })
    })

    it('does not skip route when params.parse throws', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse: () => {
                  throw 'invalid id'
                },
              },
            },
          },
          {
            id: '/$slug',
            fullPath: '/$slug',
            path: '$slug',
          },
        ]),
      )

      const result = findRouteMatch('/hello-world', processedTree)
      expect(result?.route.id).toBe('/$id')
    })

    it('skips only false returns, not thrown params.parse errors', () => {
      const parse = vi.fn(({ id }: Record<string, string>) => {
        if (id === 'skip') return false
        if (id === 'boom') throw new Error('invalid id')
        return { id }
      })
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse,
              },
            },
          },
          {
            id: '/$slug',
            fullPath: '/$slug',
            path: '$slug',
          },
        ]),
      )

      expect(findRouteMatch('/ok', processedTree)?.route.id).toBe('/$id')
      expect(findRouteMatch('/skip', processedTree)?.route.id).toBe('/$slug')
      expect(findRouteMatch('/boom', processedTree)?.route.id).toBe('/$id')
    })

    it('surfaces thrown params.parse errors on the selected router match', () => {
      const rootRoute = new BaseRootRoute({})
      const guardedRoute = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/$id',
        params: {
          parse: ({ id }: { id: string }) => {
            if (id === 'skip') return false
            if (id === 'boom') throw new Error('invalid id')
            return { id }
          },
        },
      })
      const fallbackRoute = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/$slug',
      })
      const routeTree = rootRoute.addChildren([guardedRoute, fallbackRoute])
      const router = createTestRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: ['/ok'] }),
      })

      expect(router.matchRoutes('/skip', {}).at(-1)?.routeId).toBe('/$slug')

      const matches = router.matchRoutes('/boom', {})
      const match = matches.at(-1)!
      expect(match.routeId).toBe('/$id')
      expect(match.paramsError).toBeInstanceOf(PathParamError)
      expect((match.paramsError as Error).message).toBe('invalid id')

      expect(() =>
        router.matchRoutes('/boom', {}, { throwOnError: true }),
      ).toThrow(PathParamError)
    })

    it('calls params.parse during matching', () => {
      const parse = vi.fn((params: Record<string, string>) => params)
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse,
              },
            },
          },
        ]),
      )

      const result = findRouteMatch('/123', processedTree)
      expect(result?.route.id).toBe('/$id')
      expect(result?.rawParams).toEqual({ id: '123' })
      expect(parse).toHaveBeenCalledWith({ id: '123' })
    })
  })

  describe('priority', () => {
    it('params.parse routes take precedence over unguarded dynamic routes', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$slug',
            fullPath: '/$slug',
            path: '$slug',
          },
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse: integerParse('id'),
              },
            },
          },
        ]),
      )

      expect(findRouteMatch('/123', processedTree)?.route.id).toBe('/$id')
      expect(findRouteMatch('/hello-world', processedTree)?.route.id).toBe(
        '/$slug',
      )
    })

    it('static routes still take precedence over params.parse dynamic routes', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/settings',
            fullPath: '/settings',
            path: 'settings',
          },
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
            options: {
              params: {
                parse: (params) => params,
                priority: 999,
              },
            },
          },
        ]),
      )

      expect(findRouteMatch('/settings', processedTree)?.route.id).toBe(
        '/settings',
      )
    })

    it('deep params.parse routes can fall back to a sibling route', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$a/$b/$c',
            fullPath: '/$a/$b/$c',
            path: '$a/$b/$c',
            options: {
              params: {
                parse: parseWhen(({ c }) => c === 'three'),
              },
            },
          },
          {
            id: '/$x/$y/$z',
            fullPath: '/$x/$y/$z',
            path: '$x/$y/$z',
          },
        ]),
      )

      expect(findRouteMatch('/one/two/three', processedTree)?.route.id).toBe(
        '/$a/$b/$c',
      )
      expect(findRouteMatch('/one/two/wrong', processedTree)?.route.id).toBe(
        '/$x/$y/$z',
      )
    })

    it('params.priority breaks ties between params.parse routes', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$a',
            fullPath: '/$a',
            path: '$a',
            options: {
              params: {
                parse: (params) => params,
                priority: -1,
              },
            },
          },
          {
            id: '/$z',
            fullPath: '/$z',
            path: '$z',
            options: {
              params: {
                parse: (params) => params,
                priority: 1,
              },
            },
          },
        ]),
      )

      expect(findRouteMatch('/123', processedTree)?.route.id).toBe('/$z')
    })

    it('treats missing params.priority as 0', () => {
      const priorityOneParse = vi.fn(() => false)
      const defaultPriorityParse = vi.fn((params: Record<string, string>) => {
        return params
      })
      const priorityNegativeOneParse = vi.fn(
        (params: Record<string, string>) => {
          return params
        },
      )

      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$default',
            fullPath: '/$default',
            path: '$default',
            options: {
              params: {
                parse: defaultPriorityParse,
              },
            },
          },
          {
            id: '/$low',
            fullPath: '/$low',
            path: '$low',
            options: {
              params: {
                parse: priorityNegativeOneParse,
                priority: -1,
              },
            },
          },
          {
            id: '/$high',
            fullPath: '/$high',
            path: '$high',
            options: {
              params: {
                parse: priorityOneParse,
                priority: 1,
              },
            },
          },
        ]),
      )

      expect(findRouteMatch('/123', processedTree)?.route.id).toBe('/$default')
      expect(priorityOneParse).toHaveBeenCalledWith({ high: '123' })
      expect(defaultPriorityParse).toHaveBeenCalledWith({ default: '123' })
      expect(priorityNegativeOneParse).toHaveBeenCalledWith({ low: '123' })
      expect(priorityOneParse.mock.invocationCallOrder[0]!).toBeLessThan(
        defaultPriorityParse.mock.invocationCallOrder[0]!,
      )
      expect(defaultPriorityParse.mock.invocationCallOrder[0]!).toBeLessThan(
        priorityNegativeOneParse.mock.invocationCallOrder[0]!,
      )
    })

    it('falls through to the next params.parse route by params.priority', () => {
      const lowerPriorityParse = vi.fn((params: Record<string, string>) => {
        return params
      })
      const higherPriorityParse = vi.fn(() => false)

      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$number',
            fullPath: '/$number',
            path: '$number',
            options: {
              params: {
                parse: lowerPriorityParse,
                priority: 1,
              },
            },
          },
          {
            id: '/$uuid',
            fullPath: '/$uuid',
            path: '$uuid',
            options: {
              params: {
                parse: higherPriorityParse,
                priority: 10,
              },
            },
          },
        ]),
      )

      expect(findRouteMatch('/42', processedTree)?.route.id).toBe('/$number')
      expect(higherPriorityParse).toHaveBeenCalledWith({ uuid: '42' })
      expect(lowerPriorityParse).toHaveBeenCalledWith({ number: '42' })
      expect(higherPriorityParse.mock.invocationCallOrder[0]!).toBeLessThan(
        lowerPriorityParse.mock.invocationCallOrder[0]!,
      )
    })

    it('declaration order breaks ties between params.parse routes', () => {
      const routeTree = root([
        {
          id: '/$a',
          fullPath: '/$a',
          path: '$a',
          options: {
            params: {
              parse: (params) => params,
            },
          },
        },
        {
          id: '/$z',
          fullPath: '/$z',
          path: '$z',
          options: {
            params: {
              parse: (params) => params,
            },
          },
        },
      ])
      expect(
        findRouteMatch('/123', processRouteTree(routeTree).processedTree)?.route
          .id,
      ).toBe('/$a')
    })
  })

  describe('regex-like match patterns', () => {
    it('matches UUID values before falling back to a slug route', () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$uuid',
            fullPath: '/$uuid',
            path: '$uuid',
            options: {
              params: {
                parse: parseWhen(({ uuid }) => uuidRegex.test(uuid!)),
              },
            },
          },
          {
            id: '/$slug',
            fullPath: '/$slug',
            path: '$slug',
          },
        ]),
      )

      expect(
        findRouteMatch('/550e8400-e29b-41d4-a716-446655440000', processedTree)
          ?.route.id,
      ).toBe('/$uuid')
      expect(findRouteMatch('/my-blog-post', processedTree)?.route.id).toBe(
        '/$slug',
      )
    })

    it('matches dates before falling back to a slug route', () => {
      const isDate = (date: string | undefined) => {
        if (!date) return false
        return !Number.isNaN(new Date(date).getTime())
      }
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/posts/$date',
            fullPath: '/posts/$date',
            path: 'posts/$date',
            options: {
              params: {
                parse: parseWhen(({ date }) => isDate(date)),
              },
            },
          },
          {
            id: '/posts/$slug',
            fullPath: '/posts/$slug',
            path: 'posts/$slug',
          },
        ]),
      )

      const dateResult = findRouteMatch('/posts/2024-01-15', processedTree)
      expect(dateResult?.route.id).toBe('/posts/$date')
      expect(dateResult?.rawParams.date).toBe('2024-01-15')
      expect(
        findRouteMatch('/posts/my-first-post', processedTree)?.route.id,
      ).toBe('/posts/$slug')
    })
  })

  describe('nested routes', () => {
    it('parent params.parse failure prevents child matching', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/$orgId',
            fullPath: '/$orgId',
            path: '$orgId',
            options: {
              params: {
                parse: integerParse('orgId'),
              },
            },
            children: [
              {
                id: '/$orgId/settings',
                fullPath: '/$orgId/settings',
                path: 'settings',
              },
            ],
          },
          {
            id: '/$slug/about',
            fullPath: '/$slug/about',
            path: '$slug/about',
          },
        ]),
      )

      expect(findRouteMatch('/123/settings', processedTree)?.route.id).toBe(
        '/$orgId/settings',
      )
      expect(findRouteMatch('/my-org/about', processedTree)?.route.id).toBe(
        '/$slug/about',
      )
      expect(findRouteMatch('/my-org/settings', processedTree)).toBeNull()
    })

    it('child params.parse failure falls back to sibling route', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/users',
            fullPath: '/users',
            path: 'users',
            children: [
              {
                id: '/users/$userId',
                fullPath: '/users/$userId',
                path: '$userId',
                options: {
                  params: {
                    parse: integerParse('userId'),
                  },
                },
              },
              {
                id: '/users/$username',
                fullPath: '/users/$username',
                path: '$username',
              },
            ],
          },
        ]),
      )

      const numericResult = findRouteMatch('/users/42', processedTree)
      expect(numericResult?.route.id).toBe('/users/$userId')
      expect(numericResult?.rawParams).toEqual({ userId: '42' })

      const usernameResult = findRouteMatch('/users/johndoe', processedTree)
      expect(usernameResult?.route.id).toBe('/users/$username')
      expect(usernameResult?.rawParams).toEqual({ username: 'johndoe' })
    })
  })

  describe('pathless routes', () => {
    it('pathless layout with params.parse gates children', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/',
            fullPath: '/',
            path: '/',
          },
          {
            id: '/$foo/_layout',
            fullPath: '/$foo',
            path: '$foo',
            options: {
              params: {
                parse: integerParse('foo'),
              },
            },
            children: [
              {
                id: '/$foo/_layout/bar',
                fullPath: '/$foo/bar',
                path: 'bar',
              },
              {
                id: '/$foo/_layout/',
                fullPath: '/$foo/',
                path: '/',
              },
            ],
          },
          {
            id: '/$foo/hello',
            fullPath: '/$foo/hello',
            path: '$foo/hello',
          },
        ]),
      )

      expect(findRouteMatch('/123/bar', processedTree)?.route.id).toBe(
        '/$foo/_layout/bar',
      )
      const indexResult = findRouteMatch('/123', processedTree)
      expect(indexResult?.route.id).toBe('/$foo/_layout/')
      expect(indexResult?.rawParams).toEqual({ foo: '123' })

      expect(findRouteMatch('/abc/hello', processedTree)?.route.id).toBe(
        '/$foo/hello',
      )
      expect(findRouteMatch('/abc/bar', processedTree)).toBeNull()
    })
  })

  describe('optional params', () => {
    it('optional param with static fallback', () => {
      const validLangs = ['en', 'es', 'fr', 'de']
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/{-$lang}/home',
            fullPath: '/{-$lang}/home',
            path: '{-$lang}/home',
            options: {
              params: {
                parse: parseWhen(
                  ({ lang }) => !lang || validLangs.includes(lang),
                ),
              },
            },
          },
          {
            id: '/home',
            fullPath: '/home',
            path: 'home',
          },
        ]),
      )

      expect(findRouteMatch('/en/home', processedTree)?.route.id).toBe(
        '/{-$lang}/home',
      )
      expect(findRouteMatch('/home', processedTree)?.route.id).toBe(
        '/{-$lang}/home',
      )
      expect(findRouteMatch('/it/home', processedTree)).toBeNull()
    })

    it('optional param at root can match or skip the optional segment', () => {
      const validLangs = ['en', 'es', 'fr', 'de']
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/{-$lang}',
            fullPath: '/{-$lang}',
            path: '{-$lang}',
            options: {
              params: {
                parse: parseWhen(
                  ({ lang }) => !lang || validLangs.includes(lang),
                ),
              },
            },
          },
        ]),
      )

      expect(findRouteMatch('/en', processedTree)?.route.id).toBe('/{-$lang}')
      expect(findRouteMatch('/', processedTree)?.route.id).toBe('/{-$lang}')
      expect(findRouteMatch('/about', processedTree)).toBeNull()
    })
  })

  describe('wildcard routes', () => {
    it('wildcard with params.parse falls back in fuzzy mode', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/files/$',
            fullPath: '/files/$',
            path: 'files/$',
            options: {
              params: {
                parse: parseWhen(({ _splat }) => !_splat!.includes('..')),
              },
            },
          },
          {
            id: '/files',
            fullPath: '/files',
            path: 'files',
          },
        ]),
      )

      expect(
        findRouteMatch('/files/docs/readme.txt', processedTree)?.route.id,
      ).toBe('/files/$')

      const result = findRouteMatch(
        '/files/../../secret/photo.jpg',
        processedTree,
        true,
      )
      expect(result?.route.id).toBe('/files')
      expect(result?.rawParams['**']).toBe('../../secret/photo.jpg')
    })

    it('index params.parse failure does not block wildcard sibling', () => {
      const { processedTree } = processRouteTree(
        root([
          {
            id: '/a/',
            fullPath: '/a/',
            path: 'a/',
            options: {
              params: {
                parse: () => false,
              },
            },
          },
          {
            id: '/a/$',
            fullPath: '/a/$',
            path: 'a/$',
          },
        ]),
      )

      const result = findRouteMatch('/a', processedTree)
      expect(result?.route.id).toBe('/a/$')
      expect(result?.rawParams).toEqual({ '*': '', _splat: '' })
    })
  })
})
