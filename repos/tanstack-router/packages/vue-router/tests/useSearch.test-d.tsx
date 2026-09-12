import { describe, expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter, useSearch } from '../src'
import type * as Vue from 'vue'
import type { SearchSchemaInput } from '../src'

describe('useSearch', () => {
  test('when there are no search params', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter>)
      .parameter(0)
      .toHaveProperty('from')
      .toEqualTypeOf<
        '/invoices' | '__root__' | '/invoices/$invoiceId' | '/invoices/' | '/'
      >()

    expectTypeOf(useSearch<DefaultRouter>)
      .parameter(0)
      .toHaveProperty('strict')
      .toEqualTypeOf<true | undefined>()

    expectTypeOf(useSearch<DefaultRouter, '/'>)
      .parameter(0)
      .toHaveProperty('select')
      .parameter(0)
      .toEqualTypeOf<{}>()

    expectTypeOf(useSearch<DefaultRouter, '/'>)
      .parameter(0)
      .toHaveProperty('select')
      .returns.toEqualTypeOf<unknown>()

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(
      useSearch<DefaultRouter, '/', false>({
        strict: false,
      }),
    ).toEqualTypeOf<Vue.Ref<{}>>()
  })

  test('when there is one search params', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
      validateSearch: () => ({ page: 0 }),
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
      Vue.Ref<{
        page: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { page: number }) => unknown) | undefined>()

    expectTypeOf(
      useSearch<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<Vue.Ref<{ page?: number }>>()

    expectTypeOf(useSearch<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { page?: number }) => unknown) | undefined>()

    expectTypeOf(
      useSearch<
        DefaultRouter,
        '/invoices',
        /* strict */ false,
        /* shouldThrow */ true,
        number
      >,
    ).returns.toEqualTypeOf<Vue.Ref<number>>()

    expectTypeOf(
      useSearch<
        DefaultRouter,
        '/invoices',
        /* strict */ false,
        /* shouldThrow */ true,
        { func: () => void }
      >,
    )
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        ((search: { page?: number }) => { func: () => void }) | undefined
      >()
  })

  test('when there are multiple search params', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
      validateSearch: () => ({ page: 0 }),
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
      validateSearch: () => ({ detail: 'detail' }),
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
      Vue.Ref<{
        page: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { page: number }) => unknown) | undefined>()

    expectTypeOf(
      useSearch<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<Vue.Ref<{ page?: number; detail?: string }>>()

    expectTypeOf(useSearch<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        ((search: { page?: number; detail?: string }) => unknown) | undefined
      >()
  })

  test('when there are overlapping search params', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
      validateSearch: () => ({ page: 0 }),
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
      validateSearch: () => ({ detail: 50 }) as const,
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
      validateSearch: () => ({ detail: 'detail' }) as const,
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
      Vue.Ref<{
        page: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { page: number }) => unknown) | undefined>()

    expectTypeOf(
      useSearch<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<
      Vue.Ref<{ page?: number; detail?: 'detail' | 50 }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        | ((search: { page?: number; detail?: 'detail' | 50 }) => unknown)
        | undefined
      >()
  })

  test('when the root has no search params but the index route does', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: () => ({ indexPage: 0 }),
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{
        indexPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '__root__'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: {}) => unknown) | undefined>()

    expectTypeOf(
      useSearch<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<Vue.Ref<{ indexPage?: number }>>()

    expectTypeOf(useSearch<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        ((search: { indexPage?: number }) => unknown) | undefined
      >()
  })

  test('when the root has search params but the index route does not', () => {
    const rootRoute = createRootRoute({
      validateSearch: () => ({ rootPage: 0 }),
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{
        rootPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '__root__'>).returns.toEqualTypeOf<
      Vue.Ref<{
        rootPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
      Vue.Ref<{
        rootPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { rootPage: number }) => unknown) | undefined>()

    expectTypeOf(
      useSearch<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<Vue.Ref<{ rootPage?: number }>>()

    expectTypeOf(useSearch<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { rootPage?: number }) => unknown) | undefined>()
  })

  test('when the root has search params but the index does', () => {
    const rootRoute = createRootRoute({
      validateSearch: () => ({ rootPage: 0 }),
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: () => ({ indexPage: 0 }),
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
    })

    const invoicesIndexRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '/',
    })

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useSearch<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{
        rootPage: number
        indexPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '__root__'>).returns.toEqualTypeOf<
      Vue.Ref<{
        rootPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
      Vue.Ref<{
        rootPage: number
      }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { rootPage: number }) => unknown) | undefined>()

    expectTypeOf(
      useSearch<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<
      Vue.Ref<{ indexPage?: number; rootPage?: number }>
    >()

    expectTypeOf(useSearch<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        | ((search: { indexPage?: number; rootPage?: number }) => unknown)
        | undefined
      >()
  })

  test('when a route has search params using SearchSchemaInput', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: (input: { page?: number } & SearchSchemaInput) => {
        return { page: input.page ?? 0 }
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createRouter({ routeTree })
    expectTypeOf(useSearch<typeof router, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{
        page: number
      }>
    >
  })

  test('when route has a union of search params', () => {
    const rootRoute = createRootRoute()

    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: (): { status: 'in' } | { status: 'out' } => {
        return { status: 'in' }
      },
    })

    const indexRoute = createRoute({
      getParentRoute: () => postRoute,
      path: '/',
      validateSearch: (): { detail: string } => {
        return { detail: 'detail' }
      },
    })

    const routeTree = rootRoute.addChildren([
      indexRoute.addChildren([indexRoute]),
    ])

    const router = createRouter({ routeTree })
    expectTypeOf(useSearch<typeof router, '/'>).returns.toEqualTypeOf<
      Vue.Ref<
        { status: 'in'; detail: string } | { status: 'out'; detail: string }
      >
    >
  })

  describe('shouldThrow', () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
      validateSearch: () => ({ page: 0 }),
    })

    const routeTree = rootRoute.addChildren([invoicesRoute, indexRoute])

    const router = createRouter({ routeTree })

    const from = '/invoices'
    test('return type is `{ page: number }` when shouldThrow = true', () => {
      const shouldThrow = true
      const search = useSearch<
        typeof router,
        typeof from,
        /* strict */ true,
        typeof shouldThrow
      >({ from, shouldThrow })

      expectTypeOf(search).toEqualTypeOf<Vue.Ref<{ page: number }>>()
    })

    test('return type is `{page: number} | undefined` when shouldThrow = false', () => {
      const shouldThrow = false
      const search = useSearch<
        typeof router,
        typeof from,
        /* strict */ true,
        typeof shouldThrow
      >({ from, shouldThrow })

      expectTypeOf(search).toEqualTypeOf<
        Vue.Ref<{ page: number } | undefined>
      >()
    })
  })
})
