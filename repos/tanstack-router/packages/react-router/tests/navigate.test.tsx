import { afterEach, describe, expect, it, test, vi } from 'vitest'

import { trailingSlashOptions } from '@tanstack/router-core'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import type { RouterHistory } from '../src'

afterEach(() => {
  vi.clearAllMocks()
})

function createTestRouter(initialHistory?: RouterHistory) {
  const history =
    initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

  const rootRoute = createRootRoute({})
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
  })
  const postIdRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '/$slug',
  })
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/p',
  })
  const projectIdRoute = createRoute({
    getParentRoute: () => projectRoute,
    path: '/$projectId',
  })
  const projectVersionRoute = createRoute({
    getParentRoute: () => projectIdRoute,
    path: '/$version',
  })
  const projectFrameRoute = createRoute({
    getParentRoute: () => projectVersionRoute,
    path: '/$framework',
  })

  const uRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/u',
  })
  const uLayoutRoute = createRoute({
    id: '_layout',
    getParentRoute: () => uRoute,
  })
  const uUsernameRoute = createRoute({
    getParentRoute: () => uLayoutRoute,
    path: '$username',
  })

  const gRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/g',
  })
  const gLayoutRoute = createRoute({
    id: 'layout',
    getParentRoute: () => gRoute,
  })
  const gUsernameRoute = createRoute({
    getParentRoute: () => gLayoutRoute,
    path: '$username',
  })
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'search',
    validateSearch: (search: Record<string, unknown>) => {
      return {
        ['foo=bar']: Number(search['foo=bar'] ?? 1),
      }
    },
  })

  const projectTree = projectRoute.addChildren([
    projectIdRoute.addChildren([
      projectVersionRoute.addChildren([projectFrameRoute]),
    ]),
  ])
  const uTree = uRoute.addChildren([uLayoutRoute.addChildren([uUsernameRoute])])
  const gTree = gRoute.addChildren([gLayoutRoute.addChildren([gUsernameRoute])])

  const routeTree = rootRoute.addChildren([
    indexRoute,
    postsRoute.addChildren([postIdRoute]),
    projectTree,
    uTree,
    gTree,
  ])
  const router = createRouter({ routeTree, history })

  return {
    router,
    routes: {
      indexRoute,
      postsRoute,
      postIdRoute,
      projectRoute,
      projectIdRoute,
      projectVersionRoute,
      projectFrameRoute,
    },
  }
}

describe('router.navigate navigation using a single path param - object syntax for updates', () => {
  it('should change $slug in "/posts/$slug" from "tanner" to "tkdodo"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      to: '/posts/$slug',
      params: { slug: 'tkdodo' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })

  it('should change $slug in "/posts/$slug" from "tanner" to "tkdodo" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      params: { slug: 'tkdodo' },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })
})

describe('router.navigate navigation using a single path param - function syntax for updates', () => {
  it('should change $slug in "/posts/$slug" from "tanner" to "tkdodo"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      to: '/posts/$slug',
      params: (p: any) => ({ ...p, slug: 'tkdodo' }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })

  it('should change $slug in "/posts/$slug" from "tanner" to "tkdodo" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      params: (p: any) => ({ ...p, slug: 'tkdodo' }),
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })
})

describe('router.navigate navigation using multiple path params - object syntax for updates', () => {
  it('should change $projectId in "/p/$projectId/$version/$framework" from "router" to "query"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/$version/$framework',
      params: { projectId: 'query' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/query/v1/react')
  })

  it('should change $projectId in "/p/$projectId/$version/$framework" from "router" to "query" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      params: { projectId: 'query' },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/query/v1/react')
  })

  it('should change $version in "/p/$projectId/$version/$framework" from "v1" to "v3"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/$version/$framework',
      params: { version: 'v3' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v3/react')
  })

  it('should change $version in "/p/$projectId/$version/$framework" from "v1" to "v3" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      params: { version: 'v3' },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v3/react')
  })

  it('should change $framework in "/p/$projectId/$version/$framework" from "react" to "vue"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/$version/$framework',
      params: { framework: 'vue' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v1/vue')
  })

  it('should change $framework in "/p/$projectId/$version/$framework" from "react" to "vue" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      params: { framework: 'vue' },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v1/vue')
  })
})

describe('router.navigate navigation using multiple path params - function syntax for updates', () => {
  it('should change $projectId in "/p/$projectId/$version/$framework" from "router" to "query"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/$version/$framework',
      params: (p: any) => ({ ...p, projectId: 'query' }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/query/v1/react')
  })

  it('should change $projectId in "/p/$projectId/$version/$framework" from "router" to "query" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      params: (p: any) => ({ ...p, projectId: 'query' }),
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/query/v1/react')
  })

  it('should change $version in "/p/$projectId/$version/$framework" from "v1" to "v3"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/$version/$framework',
      params: (p: any) => ({ ...p, version: 'v3' }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v3/react')
  })

  it('should change $version in "/p/$projectId/$version/$framework" from "v1" to "v3" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      params: (p: any) => ({ ...p, version: 'v3' }),
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v3/react')
  })

  it('should change $framework in "/p/$projectId/$version/$framework" from "react" to "vue"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/$version/$framework',
      params: (p: any) => ({ ...p, framework: 'vue' }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v1/vue')
  })

  it('should change $framework in "/p/$projectId/$version/$framework" from "react" to "vue" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      params: (p: any) => ({ ...p, framework: 'vue' }),
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/v1/vue')
  })
})

describe('router.navigate navigation using layout routes resolves correctly', () => {
  it('should resolve "/u/tanner" in "/u/_layout/$username" to "/u/tkdodo"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/u/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/u/tanner')

    await router.navigate({
      to: '/u/$username',
      params: { username: 'tkdodo' },
    })

    await router.invalidate()

    expect(router.state.location.pathname).toBe('/u/tkdodo')
  })

  it('should resolve "/u/tanner" in "/u/_layout/$username" to "/u/tkdodo" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/u/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/u/tanner')

    await router.navigate({
      params: { username: 'tkdodo' },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/u/tkdodo')
  })

  it('should resolve "/g/tanner" in "/g/layout/$username" to "/g/tkdodo"', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/g/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/g/tanner')

    await router.navigate({
      to: '/g/$username',
      params: { username: 'tkdodo' },
    })

    await router.invalidate()

    expect(router.state.location.pathname).toBe('/g/tkdodo')
  })

  it('should resolve "/g/tanner" in "/g/layout/$username" to "/g/tkdodo" w/o "to" path being provided', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/g/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/g/tanner')

    await router.navigate({
      params: { username: 'tkdodo' },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/g/tkdodo')
  })

  it('should handle search params with special characters', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/search?foo%3Dbar=2'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/search')
    expect(router.state.location.search).toStrictEqual(
      toNullObj({ 'foo=bar': 2 }),
    )

    await router.navigate({
      search: { 'foo=bar': 3 },
    } as any)
    await router.invalidate()

    expect(router.state.location.search).toStrictEqual(
      toNullObj({ 'foo=bar': 3 }),
    )
  })
})

function toNullObj<T>(obj: T): T {
  if (typeof obj === 'object') return Object.assign(Object.create(null), obj)
  return obj
}

describe('relative navigation', () => {
  it('should navigate to a child route', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts')

    await router.navigate({
      from: '/posts',
      to: './$slug',
      params: { slug: 'tkdodo' },
    })

    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })

  it('should navigate to a parent route', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      to: '..',
    })

    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should navigate to a sibling route', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      from: '/posts/$slug',
      to: '.',
      params: { slug: 'tkdodo' },
    })

    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })

  it('should navigate to a sibling route without from', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')

    await router.navigate({
      to: '.',
      params: { slug: 'tkdodo' },
    })

    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tkdodo')
  })

  it('should navigate to a parent route with .. from unsafe relative path', async () => {
    const { router } = createTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tanner/child'] }),
    )

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner/child')

    await router.navigate({
      to: '..',
      unsafeRelative: 'path',
    })

    expect(router.state.location.pathname).toBe('/posts/tanner')
  })
})

describe('router.navigate navigation using optional path parameters - object syntax for updates', () => {
  function createOptionalParamTestRouter(initialHistory?: RouterHistory) {
    const history =
      initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    // Single optional parameter
    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}',
    })

    // Multiple optional parameters
    const articlesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/articles/{-$category}/{-$slug}',
    })

    // Mixed required and optional parameters
    const projectRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/p/$projectId/{-$version}/{-$framework}',
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      postsRoute,
      articlesRoute,
      projectRoute,
    ])
    const router = createRouter({ routeTree, history })

    return {
      router,
      routes: {
        indexRoute,
        postsRoute,
        articlesRoute,
        projectRoute,
      },
    }
  }

  it('should navigate from "/posts/tech" to "/posts" by setting category to undefined', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      to: '/posts/{-$category}',
      params: { category: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should navigate from "/posts/tech" to "/posts" by setting category to undefined', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      to: '/posts/{-$category}',
      params: { category: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should navigate from "/posts" to "/posts/tech" by setting category', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts')

    await router.navigate({
      to: '/posts/{-$category}',
      params: { category: 'tech' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tech')
  })

  it('should navigate from "/posts/tech" to "/posts/news" by changing category', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      to: '/posts/{-$category}',
      params: { category: 'news' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/news')
  })

  it('should navigate without "to" path and set category to undefined', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      params: { category: undefined },
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should handle multiple optional parameters - set one to undefined', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/articles/tech/hello-world'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/articles/tech/hello-world')

    await router.navigate({
      to: '/articles/{-$category}/{-$slug}',
      params: { category: 'tech', slug: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/articles/tech')
  })

  it('should handle multiple optional parameters - set both to undefined', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/articles/tech/hello-world'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/articles/tech/hello-world')

    await router.navigate({
      to: '/articles/{-$category}/{-$slug}',
      params: { category: undefined, slug: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/articles')
  })

  it('should handle mixed required and optional parameters', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/{-$version}/{-$framework}',
      params: { projectId: 'router', version: undefined, framework: 'vue' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/vue')
  })

  it('should carry over optional parameters from current route when using empty params', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    // Navigate to a different route with optional params
    await router.navigate({
      to: '/articles/{-$category}/{-$slug}',
      params: { category: 'news' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/articles/news')

    // Navigate back to posts - should carry over 'news' from current params
    await router.navigate({
      to: '/posts/{-$category}',
      params: {},
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/news')
  })
})

describe('router.navigate navigation using optional path parameters - function syntax for updates', () => {
  function createOptionalParamTestRouter(initialHistory?: RouterHistory) {
    const history =
      initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}',
    })

    const articlesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/articles/{-$category}/{-$slug}',
    })

    const projectRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/p/$projectId/{-$version}/{-$framework}',
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      postsRoute,
      articlesRoute,
      projectRoute,
    ])
    const router = createRouter({ routeTree, history })

    return { router }
  }

  it('should navigate from "/posts/tech" to "/posts" by setting category to undefined using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      to: '/posts/{-$category}',
      params: (p: any) => ({ ...p, category: undefined }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should navigate from "/posts/tech" to "/posts" by setting category to undefined in function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      to: '/posts/{-$category}',
      params: (p: any) => ({ ...p, category: undefined }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should navigate from "/posts" to "/posts/tech" by setting category using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts')

    await router.navigate({
      to: '/posts/{-$category}',
      params: (p: any) => ({ ...p, category: 'tech' }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/tech')
  })

  it('should navigate from "/posts/tech" to "/posts/news" by changing category using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      to: '/posts/{-$category}',
      params: (p: any) => ({ ...p, category: 'news' }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/news')
  })

  it('should navigate without "to" path and set category to undefined using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    await router.navigate({
      params: (p: any) => ({ ...p, category: undefined }),
    } as any)
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should handle multiple optional parameters - remove one using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/articles/tech/hello-world'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/articles/tech/hello-world')

    await router.navigate({
      to: '/articles/{-$category}/{-$slug}',
      params: (p: any) => ({ ...p, slug: undefined }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/articles/tech')
  })

  it('should handle multiple optional parameters - clear all using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/articles/tech/hello-world'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/articles/tech/hello-world')

    await router.navigate({
      to: '/articles/{-$category}/{-$slug}',
      params: (p: any) => ({ ...p, category: undefined, slug: undefined }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/articles')
  })

  it('should handle mixed required and optional parameters using function', async () => {
    const { router } = createOptionalParamTestRouter(
      createMemoryHistory({ initialEntries: ['/p/router/v1/react'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/p/router/v1/react')

    await router.navigate({
      to: '/p/$projectId/{-$version}/{-$framework}',
      params: (p: any) => ({
        ...p,
        projectId: 'router',
        version: undefined,
        framework: 'vue',
      }),
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/p/router/vue')
  })
})

describe('router.navigate navigation using optional path parameters - parameter inheritance and isolation', () => {
  function createInheritanceTestRouter(initialHistory?: RouterHistory) {
    const history =
      initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    // Route with same optional param names but different paths
    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}',
    })

    const articlesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/articles/{-$category}',
    })

    // Route with nested optional params
    const docsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/docs/{-$version}',
    })

    const docsTopicRoute = createRoute({
      getParentRoute: () => docsRoute,
      path: '/{-$topic}',
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      postsRoute,
      articlesRoute,
      docsRoute.addChildren([docsTopicRoute]),
    ])
    const router = createRouter({ routeTree, history })

    return { router }
  }

  it('should carry over optional parameters between different routes with same param names', async () => {
    const { router } = createInheritanceTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    // Navigate to articles without specifying category
    await router.navigate({
      to: '/articles/{-$category}',
      params: {},
    })
    await router.invalidate()

    // Should carry over 'tech' from current route params
    expect(router.state.location.pathname).toBe('/articles/tech')
  })

  it('should properly handle navigation between routes with different optional param structures', async () => {
    const { router } = createInheritanceTestRouter(
      createMemoryHistory({ initialEntries: ['/posts/tech'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/posts/tech')

    // Navigate to articles with explicit category
    await router.navigate({
      to: '/articles/{-$category}',
      params: { category: 'news' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/articles/news')

    // Navigate back to posts without explicit category removal
    await router.navigate({
      to: '/posts/{-$category}',
      params: {},
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/posts/news')
  })

  it('should handle nested optional parameters correctly', async () => {
    const { router } = createInheritanceTestRouter(
      createMemoryHistory({ initialEntries: ['/docs/v1/getting-started'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/docs/v1/getting-started')

    // Remove topic but keep version
    await router.navigate({
      to: '/docs/{-$version}/{-$topic}',
      params: { version: 'v1', topic: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/docs/v1')

    // Remove version but add topic
    await router.navigate({
      to: '/docs/{-$version}/{-$topic}',
      params: { version: undefined, topic: 'api' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/docs/api')

    // Remove both
    await router.navigate({
      to: '/docs/{-$version}/{-$topic}',
      params: { version: undefined, topic: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/docs')
  })
})

describe('router.navigate navigation using optional path parameters - edge cases and validations', () => {
  function createEdgeCaseTestRouter(initialHistory?: RouterHistory) {
    const history =
      initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    // Route with prefix/suffix
    const filesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/files/prefix{-$name}.txt',
    })

    // Route with all optional params
    const dateRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/date/{-$year}/{-$month}/{-$day}',
    })

    const routeTree = rootRoute.addChildren([indexRoute, filesRoute, dateRoute])
    const router = createRouter({ routeTree, history })

    return { router }
  }

  it('should handle optional parameters with prefix/suffix correctly', async () => {
    const { router } = createEdgeCaseTestRouter(
      createMemoryHistory({ initialEntries: ['/files/prefixdocument.txt'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/files/prefixdocument.txt')

    // Remove the name parameter
    await router.navigate({
      to: '/files/prefix{-$name}.txt',
      params: { name: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/files')

    // Add the name parameter back
    await router.navigate({
      to: '/files/prefix{-$name}.txt',
      params: { name: 'report' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/files/prefixreport.txt')
  })

  it('should handle route with all optional parameters', async () => {
    const { router } = createEdgeCaseTestRouter(
      createMemoryHistory({ initialEntries: ['/date/2024/03/15'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/date/2024/03/15')

    // Remove day only
    await router.navigate({
      to: '/date/{-$year}/{-$month}/{-$day}',
      params: { year: '2024', month: '03', day: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/date/2024/03')

    // Remove month and day
    await router.navigate({
      to: '/date/{-$year}/{-$month}/{-$day}',
      params: { year: '2024', month: undefined, day: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/date/2024')

    // Remove all parameters
    await router.navigate({
      to: '/date/{-$year}/{-$month}/{-$day}',
      params: { year: undefined, month: undefined, day: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/date')

    // Add all parameters back
    await router.navigate({
      to: '/date/{-$year}/{-$month}/{-$day}',
      params: { year: '2025', month: '12', day: '31' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/date/2025/12/31')
  })

  it('should handle empty string vs undefined distinction', async () => {
    const { router } = createEdgeCaseTestRouter(
      createMemoryHistory({ initialEntries: ['/files/prefix.txt'] }),
    )

    await router.load()
    expect(router.state.location.pathname).toBe('/files/prefix.txt')

    // Set name to empty string (should still include the param)
    await router.navigate({
      to: '/files/prefix{-$name}.txt',
      params: { name: '' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/files/prefix.txt')

    // Set name to a value
    await router.navigate({
      to: '/files/prefix{-$name}.txt',
      params: { name: 'test' },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/files/prefixtest.txt')

    // Set name to undefined (should remove the param)
    await router.navigate({
      to: '/files/prefix{-$name}.txt',
      params: { name: undefined },
    })
    await router.invalidate()

    expect(router.state.location.pathname).toBe('/files')
  })
})

describe('splat routes with empty splat', () => {
  it.each(Object.values(trailingSlashOptions))(
    'should handle empty _splat parameter with trailingSlash: %s',
    async (trailingSlash) => {
      const tail = trailingSlash === 'always' ? '/' : ''

      const history = createMemoryHistory({ initialEntries: ['/'] })

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
      })

      const splatRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'splat/$',
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, splatRoute]),
        history,
        trailingSlash,
      })

      await router.load()

      // All of these route params should navigate to the same location
      const paramSets = [
        {
          _splat: '',
        },
        {
          _splat: undefined,
        },
        {},
      ]

      for (const params of paramSets) {
        await router.navigate({
          to: '/splat/$',
          params,
        })
        await router.invalidate()

        expect(router.state.location.pathname).toBe(`/splat${tail}`)
        // Navigate back to index
        await router.navigate({ to: '/' })
        await router.invalidate()
      }
    },
  )
})

describe('encoded and unicode paths', () => {
  const testCases = [
    {
      name: 'with prefix',
      path: '/foo/prefix@대{$}',
      expectedPath:
        '/foo/prefix@%EB%8C%80test[s%5C/.%5C/parameter%25!%F0%9F%9A%80%40]',
      expectedLocation: '/foo/prefix@대test[s%5C/.%5C/parameter%25!🚀%40]',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀@]',
        '*': 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
    {
      name: 'with suffix',
      path: '/foo/{$}대suffix@',
      expectedPath:
        '/foo/test[s%5C/.%5C/parameter%25!%F0%9F%9A%80%40]%EB%8C%80suffix@',
      expectedLocation: '/foo/test[s%5C/.%5C/parameter%25!🚀%40]대suffix@',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀@]',
        '*': 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
    {
      name: 'with wildcard',
      path: '/foo/$',
      expectedPath: '/foo/test[s%5C/.%5C/parameter%25!%F0%9F%9A%80]',
      expectedLocation: '/foo/test[s%5C/.%5C/parameter%25!🚀]',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀]',
        '*': 'test[s\\/.\\/parameter%!🚀]',
      },
    },
    // '/' is left as is with splat params but encoded with normal params
    {
      name: 'with path param',
      path: `/foo/$id`,
      expectedPath: '/foo/test[s%5C%2F.%5C%2Fparameter%25!%F0%9F%9A%80]',
      expectedLocation: '/foo/test[s%5C%2F.%5C%2Fparameter%25!🚀]',
      params: {
        id: 'test[s\\/.\\/parameter%!🚀]',
      },
    },
  ]

  test.each(testCases)(
    'should handle encoded, decoded paths with unicode characters correctly - $name',
    async ({ path, expectedPath, expectedLocation, params }) => {
      const rootRoute = createRootRoute()

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
      })

      const pathRoute = createRoute({
        getParentRoute: () => rootRoute,
        path,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, pathRoute]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })

      await router.load()
      await router.navigate({ to: path, params })
      await router.invalidate()

      expect(router.state.location.href).toBe(expectedPath)
      expect(router.state.location.pathname).toBe(expectedLocation)
    },
  )
})
