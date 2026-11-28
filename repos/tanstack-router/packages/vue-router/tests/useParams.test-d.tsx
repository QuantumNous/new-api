import { describe, expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter, useParams } from '../src'
import type * as Vue from 'vue'

describe('useParams', () => {
  test('when there are no params', () => {
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

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoicesIndexRoute]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useParams<DefaultRouter>)
      .parameter(0)
      .toHaveProperty('from')
      .toEqualTypeOf<'/invoices' | '__root__' | '/invoices/' | '/'>()

    expectTypeOf(useParams<DefaultRouter>)
      .parameter(0)
      .toHaveProperty('strict')
      .toEqualTypeOf<true | undefined>()

    expectTypeOf(useParams<DefaultRouter, '/'>)
      .parameter(0)
      .toHaveProperty('select')
      .parameter(0)
      .toEqualTypeOf<{}>()

    expectTypeOf(useParams<DefaultRouter, '/'>)
      .parameter(0)
      .toHaveProperty('select')
      .returns.toEqualTypeOf<unknown>()

    expectTypeOf(useParams<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(
      useParams<DefaultRouter, '/', false>({
        strict: false,
      }),
    ).toEqualTypeOf<Vue.Ref<{}>>()
  })

  test('when there is one param', () => {
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

    expectTypeOf(useParams<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(
      useParams<DefaultRouter, '/invoices/$invoiceId'>,
    ).returns.toEqualTypeOf<Vue.Ref<{ invoiceId: string }>>()

    expectTypeOf(useParams<DefaultRouter, '/invoices/$invoiceId'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { invoiceId: string }) => unknown) | undefined>()

    expectTypeOf(
      useParams<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<Vue.Ref<{ invoiceId?: string }>>()

    expectTypeOf(useParams<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        ((search: { invoiceId?: string }) => unknown) | undefined
      >()

    expectTypeOf(
      useParams<
        DefaultRouter,
        '/invoices',
        /* strict */ false,
        /* shouldThrow */ true,
        number
      >,
    ).returns.toEqualTypeOf<Vue.Ref<number>>()
  })

  test('when there are multiple params', () => {
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

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
    })

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([
        invoicesIndexRoute,
        invoiceRoute,
        postsRoute.addChildren([postRoute]),
      ]),
      indexRoute,
    ])

    const defaultRouter = createRouter({
      routeTree,
    })

    type DefaultRouter = typeof defaultRouter

    expectTypeOf(useParams<DefaultRouter, '/'>).returns.toEqualTypeOf<
      Vue.Ref<{}>
    >()

    expectTypeOf(
      useParams<DefaultRouter, '/invoices/$invoiceId'>,
    ).returns.toEqualTypeOf<Vue.Ref<{ invoiceId: string }>>()

    expectTypeOf(useParams<DefaultRouter, '/invoices/$invoiceId'>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<((search: { invoiceId: string }) => unknown) | undefined>()

    expectTypeOf(
      useParams<DefaultRouter, '/invoices', false>,
    ).returns.toEqualTypeOf<Vue.Ref<{ invoiceId?: string; postId?: string }>>()

    expectTypeOf(useParams<DefaultRouter, '/invoices', false>)
      .parameter(0)
      .toHaveProperty('select')
      .toEqualTypeOf<
        | ((search: { invoiceId?: string; postId?: string }) => unknown)
        | undefined
      >()

    expectTypeOf(
      useParams<
        DefaultRouter,
        '/invoices',
        /* strict */ true,
        /* shouldThrow */ true,
        { func: () => void }
      >,
    )
      .parameter(0)
      .exclude<undefined>()
      .toHaveProperty('select')
      .toEqualTypeOf<
        | ((search: {}) => {
            func: () => void
          })
        | undefined
      >()
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
    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$id',
    })

    const routeTree = rootRoute.addChildren([
      invoicesRoute.addChildren([invoiceRoute]),
      indexRoute,
    ])

    const router = createRouter({ routeTree })

    const from = '/invoices/$id'
    test('return type is `{ id: string }` when shouldThrow = true', () => {
      const shouldThrow = true
      const params = useParams<
        typeof router,
        typeof from,
        /* strict */ true,
        typeof shouldThrow
      >({ from, shouldThrow })

      expectTypeOf(params).toEqualTypeOf<Vue.Ref<{ id: string }>>()
    })

    test('return type is `{page: string} | undefined` when shouldThrow = false', () => {
      const shouldThrow = false
      const params = useParams<
        typeof router,
        typeof from,
        /* strict */ true,
        typeof shouldThrow
      >({ from, shouldThrow })

      expectTypeOf(params).toEqualTypeOf<Vue.Ref<{ id: string } | undefined>>()
    })
  })
})
