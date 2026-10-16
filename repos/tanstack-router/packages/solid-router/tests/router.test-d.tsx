import { expectTypeOf, test } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '../src'
import type { RouterHistory } from '../src'

test('when creating a router without context', () => {
  const rootRoute = createRootRoute()

  type RouteTree = typeof rootRoute

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toHaveProperty('routeTree')
    .toEqualTypeOf<RouteTree | undefined>()

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toHaveProperty('context')
    .toEqualTypeOf<{} | undefined>()

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .not.toMatchTypeOf<{
      context: {}
    }>()
})

test('when navigating using router', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    validateSearch: () => ({
      page: 0,
    }),
  })

  const routeTree = rootRoute.addChildren([indexRoute, postsRoute])

  const router = createRouter({
    routeTree,
  })

  expectTypeOf(router.navigate<typeof router, '/posts'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'/posts' | '/' | '.' | '..'>()

  expectTypeOf(router.navigate<typeof router, '/posts'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: Array<any>) => any>()
    .toEqualTypeOf<{ page: number }>()
})

test('when building location using router', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    validateSearch: () => ({
      page: 0,
    }),
  })

  const routeTree = rootRoute.addChildren([indexRoute, postsRoute])

  const router = createRouter({
    routeTree,
  })

  expectTypeOf(router.buildLocation<typeof router, '/posts'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'/posts' | '/' | '.' | '..'>()

  expectTypeOf(router.buildLocation<typeof router, '/posts'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: Array<any>) => any>()
    .toEqualTypeOf<{ page: number }>()
})

test('when creating a router with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  type RouteTree = typeof rootRoute

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toHaveProperty('routeTree')
    .toEqualTypeOf<RouteTree | undefined>()

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toHaveProperty('context')
    .toEqualTypeOf<{ userId: string }>()

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toMatchTypeOf<{
      context: { userId: string }
    }>()
})

test('when creating a router with context and children', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const routeTree = rootRoute.addChildren([indexRoute])

  type RouteTree = typeof routeTree

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toHaveProperty('routeTree')
    .toEqualTypeOf<RouteTree | undefined>()

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toHaveProperty('context')
    .toEqualTypeOf<{ userId: string }>()

  expectTypeOf(createRouter<RouteTree, 'never'>)
    .parameter(0)
    .toMatchTypeOf<{
      context: { userId: string }
    }>()
})

test('invalidate and clearCache narrowing in filter', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    beforeLoad: () => ({ invoicePermissions: ['view'] as const }),
  })

  const invoiceRoute = createRoute({
    path: '$invoiceId',
    getParentRoute: () => invoicesRoute,
  })

  const detailsRoute = createRoute({
    path: 'details',
    getParentRoute: () => invoiceRoute,
    validateSearch: () => ({ detailPage: 0 }),
    beforeLoad: () => ({ detailsPermissions: ['view'] as const }),
  })

  const detailRoute = createRoute({
    path: '$detailId',
    getParentRoute: () => detailsRoute,
  })

  const routeTree = rootRoute.addChildren([
    invoicesRoute.addChildren([
      invoiceRoute.addChildren([detailsRoute.addChildren([detailRoute])]),
    ]),
  ])

  const router = createRouter({
    routeTree,
    context: { userId: 'userId' },
  })

  type Router = typeof router

  router.invalidate({
    filter: (route) => {
      expectTypeOf(route.routeId).toEqualTypeOf<
        | '__root__'
        | '/invoices'
        | '/invoices/$invoiceId'
        | '/invoices/$invoiceId/details'
        | '/invoices/$invoiceId/details/$detailId'
      >()

      if (route.routeId === '/invoices/$invoiceId/details/$detailId') {
        expectTypeOf(route.params).branded.toEqualTypeOf<{
          invoiceId: string
          detailId: string
        }>()
      }
      return true
    },
  })

  router.clearCache({
    filter: (route) => {
      expectTypeOf(route.routeId).toEqualTypeOf<
        | '__root__'
        | '/invoices'
        | '/invoices/$invoiceId'
        | '/invoices/$invoiceId/details'
        | '/invoices/$invoiceId/details/$detailId'
      >()

      if (route.routeId === '/invoices/$invoiceId/details/$detailId') {
        expectTypeOf(route.params).branded.toEqualTypeOf<{
          invoiceId: string
          detailId: string
        }>()
      }
      return true
    },
  })
})

test('when creating a router with default router history', () => {
  const router = createRouter({ routeTree: createRootRoute() })

  expectTypeOf(router.history).toEqualTypeOf<RouterHistory>()
})

test('when creating a router with custom router history', () => {
  const customRouterHistory = {
    ...createMemoryHistory(),
    _isCustomRouterHistory: true,
  }

  const router = createRouter({
    routeTree: createRootRoute(),
    history: customRouterHistory,
  })

  expectTypeOf(router.history).toMatchTypeOf<RouterHistory>()
  expectTypeOf(router.history).toEqualTypeOf<typeof customRouterHistory>()
})
