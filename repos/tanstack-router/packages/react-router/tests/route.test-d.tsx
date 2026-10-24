import { expectTypeOf, test } from 'vitest'
import {
  createRootRoute,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '../src'
import type {
  BuildLocationFn,
  ControlledPromise,
  NavigateFn,
  NavigateOptions,
  SearchSchemaInput,
} from '../src'
import type {
  AnyRoute,
  AnyRouter,
  Expand,
  MakeRouteMatchFromRoute,
  MakeRouteMatchUnion,
  ParsedLocation,
} from '@tanstack/router-core'

test('when creating the root', () => {
  const rootRoute = createRootRoute()

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()
})

test('when creating the root with routeContext', () => {
  const rootRoute = createRootRoute({
    context: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: {}
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '__root__'
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()
})

test('when creating the root with beforeLoad', () => {
  const rootRoute = createRootRoute({
    beforeLoad: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: {}
        search: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '__root__'
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()
})

test('when creating the root with a loader', () => {
  const rootRoute = createRootRoute({
    loader: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        deps: {}
        context: {}
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: never
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()
})

test('when creating the root route with context and routeContext', () => {
  const createRouteResult = createRootRouteWithContext<{ userId: string }>()
  const rootRoute = createRouteResult({
    context: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '__root__'
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute,
    context: { userId: '123' },
  })

  expectTypeOf(rootRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
  }>()

  expectTypeOf(rootRoute.useRouteContext<typeof router>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((context: { userId: string }) => unknown) | undefined>()
})

test('when creating the root route with context and beforeLoad', () => {
  const createRouteResult = createRootRouteWithContext<{ userId: string }>()

  const rootRoute = createRouteResult({
    beforeLoad: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        search: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '__root__'
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute,
    context: { userId: '123' },
  })

  expectTypeOf(rootRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
  }>()

  expectTypeOf(rootRoute.useRouteContext<typeof router>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((context: { userId: string }) => unknown) | undefined>()
})

test('when creating the root route with context and a loader', () => {
  const createRouteResult = createRootRouteWithContext<{ userId: string }>()

  const rootRoute = createRouteResult({
    loader: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        deps: {}
        context: { userId: string }
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: never
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute,
    context: { userId: '123' },
  })

  expectTypeOf(rootRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
  }>()

  expectTypeOf(rootRoute.useRouteContext<typeof router>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((context: { userId: string }) => unknown) | undefined>()
})

test('when creating the root route with context, routeContext, beforeLoad and a loader', () => {
  const createRouteResult = createRootRouteWithContext<{ userId: string }>()

  const rootRoute = createRouteResult({
    context: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '__root__'
      }>()

      return {
        env: 'env1' as const,
      }
    },
    beforeLoad: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string; env: 'env1' }
        search: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '__root__'
      }>()
      return { permission: 'view' as const }
    },
    loader: (opts) => {
      type hi = Expand<typeof opts>
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        deps: {}
        context: { userId: string; permission: 'view'; env: 'env1' }
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: never
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>()
    },
  })

  expectTypeOf(rootRoute.fullPath).toEqualTypeOf<'/'>()
  expectTypeOf(rootRoute.id).toEqualTypeOf<'__root__'>()
  expectTypeOf(rootRoute.path).toEqualTypeOf<'/'>()

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute,
    context: { userId: '123' },
  })

  expectTypeOf(rootRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
    permission: 'view'
    env: 'env1'
  }>()

  expectTypeOf(rootRoute.useRouteContext<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      | ((context: {
          userId: string
          permission: 'view'
          env: 'env1'
        }) => string)
      | undefined
    >()
})

test('when creating a child route from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
  })

  expectTypeOf(invoicesRoute.fullPath).toEqualTypeOf<'/invoices'>()
  expectTypeOf(invoicesRoute.path).toEqualTypeOf<'invoices'>()
  expectTypeOf(invoicesRoute.id).toEqualTypeOf<'/invoices'>()
})

test('when creating a child route from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
    context: { userId: '123' },
  })

  expectTypeOf(rootRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
  }>()

  expectTypeOf(rootRoute.useRouteContext<typeof router>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((context: { userId: string }) => unknown) | undefined>()
})

test('when creating a child route with routeContext from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    context: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices'
      }>()

      return {
        env: 'env1' as const,
      }
    },
  })
})

test('when creating a child route with beforeLoad from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    beforeLoad: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        search: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices'
      }>()
    },
  })
})

test('when creating a child route with a loader from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    loader: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        deps: {}
        context: {}
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<MakeRouteMatchFromRoute<typeof rootRoute>>
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>()
      return [{ id: 'invoice1' }, { id: 'invoice2' }] as const
    },
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(invoicesRoute.useLoaderData<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      | ((
          search: readonly [
            { readonly id: 'invoice1' },
            { readonly id: 'invoice2' },
          ],
        ) => string)
      | undefined
    >()

  expectTypeOf(invoicesRoute.useLoaderData<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()

  expectTypeOf(invoicesRoute.useLoaderData<typeof router>()).toEqualTypeOf<
    readonly [{ readonly id: 'invoice1' }, { readonly id: 'invoice2' }]
  >()
})

test('when creating a child route with a loader from the root route with context', () => {
  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    loader: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        deps: {}
        context: { userId: string }
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<MakeRouteMatchFromRoute<typeof rootRoute>>
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>()
      return [{ id: 'invoice1' }, { id: 'invoice2' }] as const
    },
  })

  const rootRoute = createRootRouteWithContext<{
    userId: string
  }>()()

  const routeTree = rootRoute.addChildren([invoicesRoute])

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree,
    context: { userId: '123' },
  })

  expectTypeOf(invoicesRoute.useLoaderData<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      | ((
          search: readonly [
            { readonly id: 'invoice1' },
            { readonly id: 'invoice2' },
          ],
        ) => string)
      | undefined
    >()

  expectTypeOf(invoicesRoute.useLoaderData<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()

  expectTypeOf(invoicesRoute.useLoaderData<typeof router>()).toEqualTypeOf<
    readonly [{ readonly id: 'invoice1' }, { readonly id: 'invoice2' }]
  >()

  expectTypeOf(invoicesRoute.useLoaderData<typeof router>()).toEqualTypeOf<
    readonly [{ readonly id: 'invoice1' }, { readonly id: 'invoice2' }]
  >()
})

test('when creating a child route with search params from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(invoicesRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>()

  expectTypeOf(invoicesRoute.useSearch<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((search: { page: number }) => number) | undefined>()

  expectTypeOf(invoicesRoute.useSearch<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with optional search params from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    validateSearch: (): { page?: number } => ({ page: 0 }),
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(invoicesRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page?: number
  }>()

  expectTypeOf(invoicesRoute.useSearch<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      ((search: { page?: number | undefined }) => number) | undefined
    >()

  expectTypeOf(invoicesRoute.useSearch<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with params from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(invoicesRoute.useParams<typeof router>()).toEqualTypeOf<{
    invoiceId: string
  }>()

  expectTypeOf(invoicesRoute.useParams<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((params: { invoiceId: string }) => number) | undefined>()

  expectTypeOf(invoicesRoute.useParams<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with a splat param from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices/$',
    getParentRoute: () => rootRoute,
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(invoicesRoute.useParams<typeof router>()).toEqualTypeOf<{
    _splat?: string
  }>()

  expectTypeOf(invoicesRoute.useParams<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<((params: { _splat?: string }) => number) | undefined>()

  expectTypeOf(invoicesRoute.useParams<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with a param and splat param from the root route', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices/$invoiceId/$',
    getParentRoute: () => rootRoute,
  })
  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  const params = invoicesRoute.useParams<typeof router>()

  expectTypeOf(invoicesRoute.useParams<typeof router>()).toEqualTypeOf<{
    invoiceId: string
    _splat?: string
  }>()

  expectTypeOf(invoicesRoute.useParams<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      ((params: { invoiceId: string; _splat?: string }) => number) | undefined
    >()

  expectTypeOf(invoicesRoute.useParams<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with params, search and loader from the root route', () => {
  const rootRoute = createRootRoute()

  createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    loader: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        deps: {}
        context: {}
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<MakeRouteMatchFromRoute<typeof rootRoute>>
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>
    },
  })
})

test('when creating a child route with params, search, loader and loaderDeps from the root route', () => {
  const rootRoute = createRootRoute()

  createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    loaderDeps: (deps) => ({ page: deps.search.page }),
    loader: (opts) =>
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        deps: { page: number }
        context: {}
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<MakeRouteMatchFromRoute<typeof rootRoute>>
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>(),
  })
})

test('when creating a child route with params, search, loader and loaderDeps from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    loaderDeps: (deps) => ({ page: deps.search.page }),
    loader: (opts) =>
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        deps: { page: number }
        context: { userId: string }
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<MakeRouteMatchFromRoute<typeof rootRoute>>
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>(),
  })
})

test('when creating a child route with params, search with routeContext from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    context: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/$invoiceId'
      }>()
    },
  })
})

test('when creating a child route with params, search with beforeLoad from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    beforeLoad: (opts) => {
      expectTypeOf(opts).toMatchTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        search: { page: number }
        matches: Array<MakeRouteMatchUnion>
      }>()
    },
  })
})

test('when creating a child route with params, search with routeContext, beforeLoad and a loader from the root route with context', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    context: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/$invoiceId'
      }>()
      return {
        env: 'env1',
      }
    },
    beforeLoad: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string; env: string }
        search: { page: number }
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/$invoiceId'
      }>()
      return { permission: 'view' } as const
    },
    loader: (opts) => {
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        deps: {}
        context: { userId: string; env: string; readonly permission: 'view' }
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<MakeRouteMatchFromRoute<typeof rootRoute>>
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>()
    },
  })
})

test('when creating a child route with params from a parent with params', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices/$invoiceId',
    getParentRoute: () => rootRoute,
  })

  const detailsRoute = createRoute({
    path: '$detailId',
    getParentRoute: () => invoicesRoute,
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      invoicesRoute.addChildren([detailsRoute]),
    ]),
  })

  expectTypeOf(detailsRoute.useParams<typeof router>()).toEqualTypeOf<{
    invoiceId: string
    detailId: string
  }>()

  expectTypeOf(detailsRoute.useParams<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      ((params: { invoiceId: string; detailId: string }) => number) | undefined
    >()

  expectTypeOf(detailsRoute.useParams<typeof router, string>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with search from a parent with search', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ invoicePage: 0 }),
  })

  const detailsRoute = createRoute({
    path: 'details',
    getParentRoute: () => invoicesRoute,
    validateSearch: () => ({ detailPage: 0 }),
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      invoicesRoute.addChildren([detailsRoute]),
    ]),
  })

  expectTypeOf(detailsRoute.useSearch<typeof router>()).toEqualTypeOf<{
    invoicePage: number
    detailPage: number
  }>()

  expectTypeOf(detailsRoute.useSearch<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      | ((params: { invoicePage: number; detailPage: number }) => number)
      | undefined
    >()

  expectTypeOf(detailsRoute.useSearch<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('structuralSharing')
    .toEqualTypeOf<boolean | undefined>()
})

test('when creating a child route with routeContext from a parent with routeContext', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    context: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices'
      }>()

      return { invoiceId: 'invoiceId1' }
    },
  })

  const detailsRoute = createRoute({
    path: 'details',
    getParentRoute: () => invoicesRoute,
    context: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string; invoiceId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/details'
      }>()

      return { detailId: 'detailId1' }
    },
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      invoicesRoute.addChildren([detailsRoute]),
    ]),
    context: { userId: '123' },
  })

  expectTypeOf(detailsRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
    invoiceId: string
    detailId: string
  }>()

  expectTypeOf(detailsRoute.useRouteContext<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      | ((params: {
          userId: string
          invoiceId: string
          detailId: string
        }) => number)
      | undefined
    >()
})

test('when creating a child route with beforeLoad from a parent with beforeLoad', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    beforeLoad: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        search: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices'
      }>()
      return { invoiceId: 'invoiceId1' }
    },
  })

  const detailsRoute = createRoute({
    path: 'details',
    getParentRoute: () => invoicesRoute,
    beforeLoad: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string; invoiceId: string }
        search: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/details'
      }>()
      return { detailId: 'detailId1' }
    },
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      invoicesRoute.addChildren([detailsRoute]),
    ]),
    context: { userId: '123' },
  })

  expectTypeOf(detailsRoute.useRouteContext<typeof router>()).toEqualTypeOf<{
    userId: string
    invoiceId: string
    detailId: string
  }>()

  expectTypeOf(detailsRoute.useRouteContext<typeof router, number>)
    .parameter(0)
    .exclude<undefined>()
    .toHaveProperty('select')
    .toEqualTypeOf<
      | ((params: {
          userId: string
          invoiceId: string
          detailId: string
        }) => number)
      | undefined
    >()
})

test('when creating a child route with routeContext, beforeLoad, search, params, loaderDeps and loader', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

  const invoicesRoute = createRoute({
    path: 'invoices',
    getParentRoute: () => rootRoute,
    validateSearch: () => ({ page: 0 }),
    context: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices'
      }>()
      return { env: 'env1' }
    },
    beforeLoad: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: {}
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: { userId: string; env: string }
        search: { page: number }
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices'
      }>()
      return { invoicePermissions: ['view'] as const }
    },
  })

  const invoiceRoute = createRoute({
    path: '$invoiceId',
    getParentRoute: () => invoicesRoute,
  })

  const detailsRoute = createRoute({
    path: 'details',
    getParentRoute: () => invoiceRoute,
    validateSearch: () => ({ detailPage: 0 }),
    context: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: {
          userId: string
          env: string
          invoicePermissions: readonly ['view']
        }
        deps: {}
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/$invoiceId/details'
      }>()
      return { detailEnv: 'detailEnv' }
    },
    beforeLoad: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: {
          detailEnv: string
          userId: string
          env: string
          invoicePermissions: readonly ['view']
        }
        search: { page: number; detailPage: number }
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/$invoiceId/details'
      }>()
      return { detailsPermissions: ['view'] as const }
    },
  })

  const detailRoute = createRoute({
    path: '$detailId',
    getParentRoute: () => detailsRoute,
    loaderDeps: (deps) => ({
      detailPage: deps.search.detailPage,
      invoicePage: deps.search.page,
    }),
    context: (opt) => {
      expectTypeOf(opt).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string; detailId: string }
        location: ParsedLocation
        navigate: NavigateFn
        buildLocation: BuildLocationFn
        cause: 'preload' | 'enter' | 'stay'
        context: {
          userId: string
          env: string
          invoicePermissions: readonly ['view']
          detailEnv: string
          detailsPermissions: readonly ['view']
        }
        deps: { detailPage: number; invoicePage: number }
        matches: Array<MakeRouteMatchUnion>
        routeId: '/invoices/$invoiceId/details/$detailId'
      }>()
      return { detailEnv: 'detailEnv' }
    },
    loader: (opts) =>
      expectTypeOf(opts).toEqualTypeOf<{
        abortController: AbortController
        preload: boolean
        params: { invoiceId: string; detailId: string }
        deps: { detailPage: number; invoicePage: number }
        context: {
          userId: string
          env: string
          invoicePermissions: readonly ['view']
          detailEnv: string
          detailsPermissions: readonly ['view']
        }
        location: ParsedLocation
        navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
        parentMatchPromise: Promise<
          MakeRouteMatchFromRoute<typeof detailsRoute>
        >
        cause: 'preload' | 'enter' | 'stay'
        route: AnyRoute
      }>(),
  })
})

test('when creating a child route with context, search, params and beforeLoad', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

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
    beforeLoad: (opts) => {
      expectTypeOf(opts).toMatchTypeOf<{
        params: { detailId: string; invoiceId: string }
        search: { detailPage: number; page: number }
        context: {
          userId: string
          detailsPermissions: readonly ['view']
          invoicePermissions: readonly ['view']
        }
      }>()
      expectTypeOf(opts.buildLocation<Router, '.', '/'>)
        .parameter(0)
        .toHaveProperty('to')
        .toEqualTypeOf<
          | '.'
          | './invoices'
          | './invoices/$invoiceId'
          | './invoices/$invoiceId/details'
          | './invoices/$invoiceId/details/$detailId'
          | undefined
        >()
    },
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
})

test('when creating a child route with context, search, params, loader, loaderDeps and onEnter, onStay, onLeave', () => {
  const rootRoute = createRootRouteWithContext<{ userId: string }>()()

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

  type TExpectedParams = { detailId: string; invoiceId: string }
  type TExpectedSearch = { detailPage: number; page: number }
  type TExpectedContext = {
    userId: string
    detailsPermissions: readonly ['view']
    invoicePermissions: readonly ['view']
    detailPermission: boolean
  }
  type TExpectedLoaderData = { detailLoader: 'detailResult' }
  type TExpectedMatch = {
    params: TExpectedParams
    search: TExpectedSearch
    context: TExpectedContext
    loaderDeps: { detailPage: number; invoicePage: number }
    beforeLoadPromise?: ControlledPromise<void>
    loaderPromise?: ControlledPromise<void>
    componentsPromise?: Promise<Array<void>>
    loaderData?: TExpectedLoaderData
  }

  createRoute({
    path: '$detailId',
    getParentRoute: () => detailsRoute,
    beforeLoad: () => ({ detailPermission: true }),
    loaderDeps: (deps) => ({
      detailPage: deps.search.detailPage,
      invoicePage: deps.search.page,
    }),
    loader: () => ({ detailLoader: 'detailResult' }) as const,
    onEnter: (match) => expectTypeOf(match).toMatchTypeOf<TExpectedMatch>(),
    onStay: (match) => expectTypeOf(match).toMatchTypeOf<TExpectedMatch>(),
    onLeave: (match) => expectTypeOf(match).toMatchTypeOf<TExpectedMatch>(),
  })
})

test('when creating a child route with parseParams and stringify params without params in path', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    parseParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{}>()
      return params
    },
    stringifyParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{}>()
      return params
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx).toHaveProperty('params').toEqualTypeOf<{}>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx).toHaveProperty('params').toEqualTypeOf<{}>()
    },
  })

  const routeTree = rootRoute.addChildren([invoicesRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(invoicesRoute.useParams<typeof router>()).toEqualTypeOf<{}>()
})

test('when creating a child route with params.parse and params.stringify without params in path', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    params: {
      parse: (params) => {
        expectTypeOf(params).toEqualTypeOf<{}>()
        return params
      },
      stringify: (params) => {
        expectTypeOf(params).toEqualTypeOf<{}>()
        return params
      },
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx).toHaveProperty('params').toEqualTypeOf<{}>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx).toHaveProperty('params').toEqualTypeOf<{}>()
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(invoicesRoute.useParams<typeof router>()).toEqualTypeOf<{}>()
})

test('when creating a child route with parseParams and stringifyParams with params in path', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoiceRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '$invoiceId',
    parseParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{ invoiceId: string }>()
      return { invoiceId: Number(params.invoiceId) }
    },
    stringifyParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{ invoiceId: number }>()
      return { invoiceId: params.invoiceId.toString() }
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([invoiceRoute]),
  })

  expectTypeOf(invoiceRoute.useParams<typeof router>()).toEqualTypeOf<{
    invoiceId: number
  }>()
})

test('when creating a child route with params.parse and params.stringify with params in path', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoiceRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '$invoiceId',
    params: {
      parse: (params) => {
        expectTypeOf(params).toEqualTypeOf<{ invoiceId: string }>()
        return { invoiceId: Number(params.invoiceId) }
      },
      stringify: (params) => {
        expectTypeOf(params).toEqualTypeOf<{ invoiceId: number }>()
        return { invoiceId: params.invoiceId.toString() }
      },
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
  })

  const router = createRouter({
    routeTree: invoicesRoute.addChildren([invoiceRoute]),
  })

  expectTypeOf(invoiceRoute.useParams<typeof router>()).toEqualTypeOf<{
    invoiceId: number
  }>()
})

test('when creating a child route with parseParams and stringifyParams with merged params from parent', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoiceRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '$invoiceId',
    parseParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{ invoiceId: string }>()
      return { invoiceId: Number(params.invoiceId) }
    },
    stringifyParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{ invoiceId: number }>()
      return { invoiceId: params.invoiceId.toString() }
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
  })

  const detailRoute = createRoute({
    getParentRoute: () => invoiceRoute,
    path: '$detailId',

    parseParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{
        detailId: string
      }>()
      return { detailId: Number(params.detailId) }
    },
    stringifyParams: (params) => {
      expectTypeOf(params).toEqualTypeOf<{ detailId: number }>()
      return { detailId: params.detailId.toString() }
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number; detailId: number }>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number; detailId: number }>()
    },
  })

  const router = createRouter({
    routeTree: invoicesRoute.addChildren([
      invoiceRoute.addChildren([detailRoute]),
    ]),
  })

  expectTypeOf(detailRoute.useParams<typeof router>()).toEqualTypeOf<{
    detailId: number
    invoiceId: number
  }>()
})

test('when creating a child route with params.parse and params.stringify with merged params from parent', () => {
  const rootRoute = createRootRoute()

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoiceRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '$invoiceId',
    params: {
      parse: (params) => {
        expectTypeOf(params).toEqualTypeOf<{ invoiceId: string }>()
        return { invoiceId: Number(params.invoiceId) }
      },
      stringify: (params) => {
        expectTypeOf(params).toEqualTypeOf<{ invoiceId: number }>()
        return { invoiceId: params.invoiceId.toString() }
      },
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number }>()
    },
  })

  const detailRoute = createRoute({
    getParentRoute: () => invoiceRoute,
    path: '$detailId',
    params: {
      parse: (params) => {
        expectTypeOf(params).toEqualTypeOf<{
          detailId: string
        }>()
        return { detailId: Number(params.detailId) }
      },
      stringify: (params) => {
        expectTypeOf(params).toEqualTypeOf<{ detailId: number }>()
        return { detailId: params.detailId.toString() }
      },
    },
    beforeLoad: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number; detailId: number }>()
    },
    loader: (ctx) => {
      expectTypeOf(ctx)
        .toHaveProperty('params')
        .toEqualTypeOf<{ invoiceId: number; detailId: number }>()
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      invoicesRoute.addChildren([invoiceRoute.addChildren([detailRoute])]),
    ]),
  })

  expectTypeOf(detailRoute.useParams<typeof router>()).toEqualTypeOf<{
    detailId: number
    invoiceId: number
  }>()
})

test('when routeContext throws', () => {
  const rootRoute = createRootRoute()
  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    context: () => {
      throw redirect({ to: '/somewhere' })
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(
    invoicesRoute.useRouteContext<typeof router>(),
  ).toEqualTypeOf<{}>()
})

test('when beforeLoad throws', () => {
  const rootRoute = createRootRoute()
  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    beforeLoad: () => {
      throw redirect({ to: '/somewhere' })
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([invoicesRoute]),
  })

  expectTypeOf(
    invoicesRoute.useRouteContext<typeof router>(),
  ).toEqualTypeOf<{}>()
})

test('when creating a child route with no explicit search input', () => {
  const rootRoute = createRootRoute({
    validateSearch: (input) => {
      expectTypeOf(input).toEqualTypeOf<Record<string, unknown>>()
      return {
        page: 0,
      }
    },
  })

  const rootRouteWithContext = createRootRouteWithContext()({
    validateSearch: (input) => {
      expectTypeOf(input).toEqualTypeOf<Record<string, unknown>>()
      return {
        page: 0,
      }
    },
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (input) => {
      expectTypeOf(input).toEqualTypeOf<Record<string, unknown>>()
      return {
        page: 0,
      }
    },
  })

  const routeTree = rootRoute.addChildren([indexRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(rootRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>()

  expectTypeOf(indexRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>()

  expectTypeOf(rootRouteWithContext.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>()

  const navigate = indexRoute.useNavigate()

  expectTypeOf(navigate<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ page: number }>()

  expectTypeOf(navigate<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ page: number }>()

  expectTypeOf(navigate<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ page: number }>()
})

test('when creating a child route with an explicit search input', () => {
  const rootRoute = createRootRoute({
    validateSearch: (input: SearchSchemaInput & { input: string }) => {
      return {
        page: input.input,
      }
    },
  })

  const rootRouteWithContext = createRootRouteWithContext()({
    validateSearch: (input: SearchSchemaInput & { input: string }) => {
      return {
        page: input.input,
      }
    },
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (input: SearchSchemaInput & { input: string }) => {
      return {
        page: input.input,
      }
    },
  })

  const routeTree = rootRoute.addChildren([indexRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(rootRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: string
  }>()

  expectTypeOf(indexRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: string
  }>()

  expectTypeOf(rootRouteWithContext.useSearch<typeof router>()).toEqualTypeOf<{
    page: string
  }>()

  const navigate = indexRoute.useNavigate()

  expectTypeOf(navigate<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ input: string }>()

  expectTypeOf(navigate<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ input: string }>()

  expectTypeOf(navigate<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ page: string }>()
})

test('when creating a route with a prefix and suffix', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'prefix{$postId}suffix',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    postId: string
  }>()
})

test('when creating a route with a optional prefix and suffix', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'prefix{-$postId}suffix',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    postId?: string
  }>()
})

test('when creating a route with a splat prefix and suffix', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'prefix{$}suffix',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    _splat?: string
  }>()
})

test('when creating a route with a splat, optional param and required param', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'docs/$docId/$/{-$detailId}/{$myFile}.pdf',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    docId: string
    _splat?: string
    myFile: string
    detailId?: string
  }>()
})

test('when creating a route with a boundary splat, optional param and required param', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'docs/$docId/before{$}after/detail{-$detailId}/file-{$myFile}.pdf',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    docId: string
    _splat?: string
    myFile: string
    detailId?: string
  }>()
})

test('when creating a route with a nested boundary splat, optional param and required param', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'docs/$docId/before{$}after/{-detail{$detailId}suffix}/file-{$myFile}.pdf',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    docId: string
    _splat?: string
    myFile: string
    detailId?: string
  }>()
})

test('when creating a route with a nested boundary splat, optional param, required param and escaping', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'docs/$docId/before{$}after/{-detail{$detailId}suffix}[.$test]/file-{$myFile}[.]pdf/escape-param[$postId]',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{
    docId: string
    _splat?: string
    myFile: string
    detailId?: string
  }>()
})

test('when creating a route with escaped path param', () => {
  const rootRoute = createRootRoute()

  const prefixSuffixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '[$postId]',
  })

  const routeTree = rootRoute.addChildren([prefixSuffixRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(prefixSuffixRoute.useParams<typeof router>()).toEqualTypeOf<{}>()
})
