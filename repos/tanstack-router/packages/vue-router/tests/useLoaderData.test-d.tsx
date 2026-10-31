import { expectTypeOf, test } from 'vitest'
import {
  createRootRoute,
  createRoute,
  createRouter,
  useLoaderData,
} from '../src'
import type * as Vue from 'vue'

test('when there is no loaders', () => {
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

  expectTypeOf(useLoaderData<DefaultRouter>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<'/invoices' | '__root__' | '/invoices/' | '/'>()

  expectTypeOf(useLoaderData<DefaultRouter>)
    .parameter(0)
    .toHaveProperty('strict')
    .toEqualTypeOf<true | undefined>()

  expectTypeOf(useLoaderData<DefaultRouter, '/'>)
    .parameter(0)
    .toHaveProperty('select')
    .parameter(0)
    .toMatchTypeOf<undefined>()

  expectTypeOf(useLoaderData<DefaultRouter, '/'>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(useLoaderData<DefaultRouter, '/'>).returns.toEqualTypeOf<
    Vue.Ref<undefined>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/', false>({ strict: false }))
    .toEqualTypeOf<Vue.Ref<undefined>>
})

test('when there is one loader', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    loader: () => ({ data: ['element1', 'element2'] }),
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
    context: { userId: 'userId' },
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
    Vue.Ref<{ data: Array<string> }>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
    Vue.Ref<{ data: Array<string> }>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', false>,
  ).returns.toEqualTypeOf<Vue.Ref<{ data?: Array<string> } | undefined>>()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices', false>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', false, number>,
  ).returns.toEqualTypeOf<Vue.Ref<number>>()
})

test('when there is one loader that is async', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    loader: () => Promise.resolve({ data: ['element1', 'element2'] }),
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
    context: { userId: 'userId' },
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
    Vue.Ref<{ data: Array<string> }>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
    Vue.Ref<{ data: Array<string> }>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', false>,
  ).returns.toEqualTypeOf<Vue.Ref<{ data?: Array<string> } | undefined>>()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices', false>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', false, number>,
  ).returns.toEqualTypeOf<Vue.Ref<number>>()
})

test('when there are multiple loaders', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    loader: () => ({ data: ['invoice1', 'invoice2'] }) as const,
  })

  const invoicesIndexRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '/',
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    loader: () => ({ data: ['post1', 'post2'] }) as const,
  })

  const routeTree = rootRoute.addChildren([
    invoicesRoute.addChildren([invoicesIndexRoute]),
    postsRoute,
    indexRoute,
  ])

  const defaultRouter = createRouter({
    routeTree,
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useLoaderData<DefaultRouter, '/'>).returns.toEqualTypeOf<
    Vue.Ref<undefined>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
    Vue.Ref<{
      readonly data: readonly ['invoice1', 'invoice2']
    }>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', false>,
  ).returns.toEqualTypeOf<
    Vue.Ref<
      | {
          data?:
            | readonly ['invoice1', 'invoice2']
            | readonly ['post1', 'post2']
            | undefined
        }
      | undefined
    >
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices', false>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices', false>)
    .parameter(0)
    .toHaveProperty('select')
    .parameter(0)
    .toEqualTypeOf<
      | {
          data?:
            | readonly ['invoice1', 'invoice2']
            | readonly ['post1', 'post2']
            | undefined
        }
      | undefined
    >()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', true, { func: () => void }>,
  )
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .exclude<undefined>()
    .returns.toEqualTypeOf<{ func: () => void }>()
})

test('when there are multiple loaders of objects and primtives', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    loader: () => ['invoice1', 'invoice2'] as const,
  })

  const invoicesIndexRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '/',
    loader: () => ({ invoice: { id: 1 } }) as const,
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    loader: () => ['post1', 'post2'] as const,
  })

  const routeTree = rootRoute.addChildren([
    invoicesRoute.addChildren([invoicesIndexRoute]),
    indexRoute,
    postsRoute,
  ])

  const defaultRouter = createRouter({
    routeTree,
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useLoaderData<DefaultRouter, '/'>).returns.toEqualTypeOf<
    Vue.Ref<undefined>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>).returns.toEqualTypeOf<
    Vue.Ref<readonly ['invoice1', 'invoice2']>
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>)
    .parameter(0)
    .toHaveProperty('select')
    .returns.toEqualTypeOf<unknown>()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices'>)
    .parameter(0)
    .toHaveProperty('select')
    .parameter(0)
    .toEqualTypeOf<readonly ['invoice1', 'invoice2']>()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/invoices', false>,
  ).returns.toEqualTypeOf<
    Vue.Ref<
      | readonly ['invoice1', 'invoice2']
      | readonly ['post1', 'post2']
      | {
          invoice?:
            | {
                readonly id: 1
              }
            | undefined
        }
      | undefined
    >
  >()

  expectTypeOf(useLoaderData<DefaultRouter, '/invoices', false>)
    .parameter(0)
    .toHaveProperty('select')
    .parameter(0)
    .toEqualTypeOf<
      | readonly ['invoice1', 'invoice2']
      | readonly ['post1', 'post2']
      | {
          invoice?:
            | {
                readonly id: 1
              }
            | undefined
        }
      | undefined
    >()
})
