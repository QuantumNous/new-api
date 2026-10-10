import { expectTypeOf, test } from 'vitest'
import {
  Link,
  createLink,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
} from '../src'
import type {
  CreateLinkProps,
  ResolveRelativePath,
  SearchSchemaInput,
} from '../src'

const rootRoute = createRootRoute({
  validateSearch: (): { rootPage?: number } => ({ rootPage: 0 }),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: () => ({ rootIndexPage: 0 }),
})

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
})

const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '/',
})

const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
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
  validateSearch: (): { page?: number } => ({ page: 0 }),
})

const invoiceEditRoute = createRoute({
  getParentRoute: () => invoiceRoute,
  path: 'edit',
  validateSearch: () => ({ editId: 0 }),
})

const invoiceDetailsRoute = createRoute({
  getParentRoute: () => invoiceRoute,
  path: 'details',
  validateSearch: (): { page?: number } => ({ page: 0 }),
})

const detailRoute = createRoute({
  getParentRoute: () => invoiceDetailsRoute,
  path: '$detailId',
})

const linesRoute = createRoute({
  getParentRoute: () => detailRoute,
  path: 'lines',
  validateSearch: (input: { linesPage?: number } & SearchSchemaInput) => {
    if (typeof input.linesPage !== 'number') throw new Error()

    return {
      linesPage: input.linesPage,
    }
  },
})

const linesFormRoute = createRoute({
  getParentRoute: () => linesRoute,
  path: 'form',
  validateSearch: (): { mode: 'new' | 'edit' | 'view' } => ({ mode: 'view' }),
})

const linesFormEditRoute = createRoute({
  getParentRoute: () => linesFormRoute,
  path: 'edit',
  validateSearch: (): { mode: 'view' | 'edit' | 'cancel' } => ({
    mode: 'view',
  }),
})

const routeTreeTuples = rootRoute.addChildren([
  postsRoute.addChildren([postRoute, postsIndexRoute]),
  invoicesRoute.addChildren([
    invoicesIndexRoute,
    invoiceRoute.addChildren([
      invoiceEditRoute,
      invoiceDetailsRoute.addChildren([
        detailRoute.addChildren([
          linesRoute.addChildren([
            linesFormRoute.addChildren([linesFormEditRoute]),
          ]),
        ]),
      ]),
    ]),
  ]),
  indexRoute,
])

const routeTreeObjects = rootRoute.addChildren({
  postsRoute: postsRoute.addChildren({ postRoute, postsIndexRoute }),
  invoicesRoute: invoicesRoute.addChildren({
    invoicesIndexRoute,
    invoiceRoute: invoiceRoute.addChildren({
      invoiceEditRoute,
      invoiceDetailsRoute: invoiceDetailsRoute.addChildren({
        detailRoute: detailRoute.addChildren({
          linesRoute: linesRoute.addChildren({
            linesFormRoute: linesFormRoute.addChildren({ linesFormEditRoute }),
          }),
        }),
      }),
    }),
  }),
  indexRoute,
})

const defaultRouter = createRouter({
  routeTree: routeTreeTuples,
})

const defaultRouterObjects = createRouter({
  routeTree: routeTreeObjects,
})

const routerAlwaysTrailingSlashes = createRouter({
  routeTree: routeTreeTuples,
  trailingSlash: 'always',
})

const routerNeverTrailingSlashes = createRouter({
  routeTree: routeTreeTuples,
  trailingSlash: 'never',
})

const routerPreserveTrailingSlashes = createRouter({
  routeTree: routeTreeTuples,
  trailingSlash: 'preserve',
})

type DefaultRouter = typeof defaultRouter

type DefaultRouterObjects = typeof defaultRouterObjects

type RouterAlwaysTrailingSlashes = typeof routerAlwaysTrailingSlashes

type RouterNeverTrailingSlashes = typeof routerNeverTrailingSlashes

type RouterPreserveTrailingSlashes = typeof routerPreserveTrailingSlashes

test('when navigating to the root', () => {
  const DefaultRouterLink = Link<DefaultRouter, string, '/'>
  const DefaultRouterObjectsLink = Link<DefaultRouterObjects, string, '/'>
  const RouterAlwaysTrailingSlashLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/'
  >
  const RouterNeverTrailingSlashLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/'
  >
  const RouterPreserveTrailingSlashLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    '/'
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../'
      | './'
      | '/'
      | '/invoices/'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/edit/'
      | '/posts/'
      | '/posts/$postId/'
    >()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | './'
      | '../'
      | '/'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/edit/'
      | '/posts'
      | '/posts/'
      | '/posts/$postId'
      | '/posts/$postId/'
    >()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()
})

test('when navigating from a route with no params and no search to the root', () => {
  expectTypeOf(Link<DefaultRouter, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/posts'
      | '/posts/$postId'
      | '$postId'
      | undefined
    >()

  expectTypeOf(Link<DefaultRouterObjects, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/posts'
      | '/posts/$postId'
      | '$postId'
      | undefined
    >()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../'
      | './'
      | '/'
      | '/invoices/'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/edit/'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/posts/'
      | '/posts/$postId/'
      | '$postId/'
      | undefined
    >()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/posts'
      | '/posts/$postId'
      | '$postId'
      | undefined
    >()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '.'
      | '..'
      | '../'
      | './'
      | '/'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/edit/'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/posts'
      | '/posts/'
      | '/posts/$postId'
      | '/posts/$postId/'
      | '$postId'
      | '$postId/'
      | undefined
    >()

  expectTypeOf(Link<DefaultRouter, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>().toEqualTypeOf<{
    rootPage?: number
    rootIndexPage: number
  }>

  expectTypeOf(Link<DefaultRouterObjects, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>().toEqualTypeOf<{
    rootPage?: number
    rootIndexPage: number
  }>

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>().toEqualTypeOf<{
    rootPage?: number
    rootIndexPage: number
  }>

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>().toEqualTypeOf<{
    rootPage?: number
    rootIndexPage: number
  }>

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts' | '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>().toEqualTypeOf<{
    rootPage?: number
    rootIndexPage: number
  }>

  expectTypeOf(Link<DefaultRouter, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      rootIndexPage: number
    }>()

  expectTypeOf(Link<DefaultRouterObjects, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      rootIndexPage: number
    }>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      rootIndexPage: number
    }>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      rootIndexPage: number
    }>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts' | '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      rootIndexPage: number
    }>()

  expectTypeOf(Link<DefaultRouter, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<DefaultRouterObjects, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts' | '/posts/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()
})

test('when navigating from a route with no params and no search to the current route', () => {
  expectTypeOf(Link<DefaultRouter, '/posts', '.'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'./$postId' | undefined | '.'>()

  expectTypeOf(Link<DefaultRouterObjects, '/posts', '.'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'./$postId' | undefined | '.'>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'./$postId/' | undefined | './'>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '.'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'./$postId' | undefined | '.'>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'./$postId/' | './$postId' | undefined | './' | '.'>()

  expectTypeOf(Link<DefaultRouter, '/posts/', '.'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>()
    .toEqualTypeOf<{ rootPage?: number } | undefined | true>()

  expectTypeOf(Link<DefaultRouterObjects, '/posts/', '.'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>()
    .toEqualTypeOf<{ rootPage?: number } | undefined | true>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>()
    .toEqualTypeOf<{ rootPage?: number } | undefined | true>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts/', '.'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>()
    .toEqualTypeOf<{ rootPage?: number } | undefined | true>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function>()
    .toEqualTypeOf<{ rootPage?: number } | undefined | true>()

  expectTypeOf(Link<DefaultRouter, '/posts/', '.'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<DefaultRouterObjects, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<DefaultRouter, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<DefaultRouterObjects, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts/', './'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()
})

test('when navigating from a route with no params and no search to the parent route', () => {
  expectTypeOf(Link<DefaultRouter, '/posts', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../posts'
      | '../posts/$postId'
      | '../invoices/$invoiceId'
      | '../invoices/$invoiceId/edit'
      | '../invoices/$invoiceId/details'
      | '../invoices/$invoiceId/details/$detailId'
      | '../invoices/$invoiceId/details/$detailId/lines'
      | '../invoices/$invoiceId/details/$detailId/lines/form'
      | '../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '../invoices'
      | '..'
      | undefined
    >()

  expectTypeOf(Link<DefaultRouterObjects, '/posts', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../posts'
      | '../posts/$postId'
      | '../invoices/$invoiceId'
      | '../invoices/$invoiceId/edit'
      | '../invoices/$invoiceId/details'
      | '../invoices/$invoiceId/details/$detailId'
      | '../invoices/$invoiceId/details/$detailId/lines'
      | '../invoices/$invoiceId/details/$detailId/lines/form'
      | '../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '../invoices'
      | '..'
      | undefined
    >()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts', '../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../posts/'
      | '../posts/$postId/'
      | '../invoices/$invoiceId/'
      | '../invoices/$invoiceId/edit/'
      | '../invoices/$invoiceId/details/'
      | '../invoices/$invoiceId/details/$detailId/'
      | '../invoices/$invoiceId/details/$detailId/lines/'
      | '../invoices/$invoiceId/details/$detailId/lines/form/'
      | '../invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '../invoices/'
      | '../'
      | undefined
    >()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../posts'
      | '../posts/$postId'
      | '../invoices/$invoiceId'
      | '../invoices/$invoiceId/edit'
      | '../invoices/$invoiceId/details'
      | '../invoices/$invoiceId/details/$detailId'
      | '../invoices/$invoiceId/details/$detailId/lines'
      | '../invoices/$invoiceId/details/$detailId/lines/form'
      | '../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '../invoices'
      | '..'
      | undefined
    >()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../posts'
      | '../posts/'
      | '../posts/$postId'
      | '../posts/$postId/'
      | '../invoices/$invoiceId'
      | '../invoices/$invoiceId/'
      | '../invoices/$invoiceId/edit'
      | '../invoices/$invoiceId/edit/'
      | '../invoices/$invoiceId/details'
      | '../invoices/$invoiceId/details/'
      | '../invoices/$invoiceId/details/$detailId'
      | '../invoices/$invoiceId/details/$detailId/'
      | '../invoices/$invoiceId/details/$detailId/lines'
      | '../invoices/$invoiceId/details/$detailId/lines/'
      | '../invoices/$invoiceId/details/$detailId/lines/form'
      | '../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '../invoices/$invoiceId/details/$detailId/lines/form/'
      | '../invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '../invoices'
      | '../invoices/'
      | '../'
      | '..'
      | undefined
    >()
})

test('cannot navigate to a branch with an index', () => {
  expectTypeOf(Link<DefaultRouter, string, '/invoices/$invoiceId'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/posts'
      | '/posts/$postId'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '.'
      | '..'
    >()

  expectTypeOf(Link<DefaultRouterObjects, string, '/invoices/$invoiceId'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/posts'
      | '/posts/$postId'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '.'
      | '..'
    >()

  expectTypeOf(
    Link<RouterAlwaysTrailingSlashes, string, '/invoices/$invoiceId'>,
  )
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/posts/'
      | '/posts/$postId/'
      | '/invoices/'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/edit/'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | './'
      | '../'
    >()

  expectTypeOf(Link<RouterNeverTrailingSlashes, string, '/invoices/$invoiceId'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/posts'
      | '/posts/$postId'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '.'
      | '..'
    >()

  expectTypeOf(
    Link<RouterPreserveTrailingSlashes, string, '/invoices/$invoiceId'>,
  )
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/posts'
      | '/posts/'
      | '/posts/$postId'
      | '/posts/$postId/'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/edit/'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '.'
      | '..'
      | './'
      | '../'
    >()
})

test('from autocompletes to all absolute routes', () => {
  const DefaultRouterLink = Link<DefaultRouter, '/', '/'>
  const DefaultRouterObjectsLink = Link<DefaultRouterObjects, '/', '/'>

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId'
      | '/posts/'
      | '/posts'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | undefined
    >()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId'
      | '/posts/'
      | '/posts'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | undefined
    >()
})

test('from does not allow invalid routes', () => {
  const DefaultRouterLink = Link<DefaultRouter, '/invalid', '/'>
  const DefaultRouterObjectsLink = Link<DefaultRouterObjects, '/invalid', '/'>

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId'
      | '/posts/'
      | '/posts'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | undefined
    >()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId'
      | '/posts/'
      | '/posts'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | undefined
    >()
})

test('when navigating to the same route', () => {
  const DefaultRouterLink = Link<DefaultRouter, string, string>
  const DefaultRouterObjectsLink = Link<DefaultRouterObjects, string, string>
  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    string
  >
  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    string
  >
  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    string
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()
})

test('when navigating to the parent route', () => {
  const DefaultRouterLink = Link<DefaultRouter, string, '..'>
  const DefaultRouterObjectsLink = Link<DefaultRouterObjects, string, '..'>

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '../'
  >
  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '..'
  >
  const RouterPreserveTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '..'
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()
})

test('when navigating from a route with params to the same route', () => {
  const DefaultRouterLink = Link<DefaultRouter, '/posts/$postId', string>
  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/posts/$postId',
    string
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/posts/$postId',
    string
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/posts/$postId',
    string
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    '/posts/$postId',
    string
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('params')
    .extract<boolean>()
    .toEqualTypeOf<true>()
})

test('when navigating to a route with params', () => {
  const DefaultRouterLink = Link<DefaultRouter, string, '/posts/$postId'>

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/posts/$postId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/posts/$postId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/posts/$postId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    '/posts/$postId/' | '/posts/$postId'
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  defaultRouterLinkParams.returns.toEqualTypeOf<{ postId: string }>()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<{ postId: string }>()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    postId: string
  }>()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    postId: string
  }>()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    postId: string
  }>()

  defaultRouterLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  defaultRouterObjectsLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerAlwaysTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerNeverTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerPreserveTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()
})

test('when navigating from a route with no params to a route with params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    '/invoices',
    './$invoiceId/edit'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/invoices',
    './$invoiceId/edit'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/invoices',
    './$invoiceId/edit/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices',
    './$invoiceId/edit'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices',
    './$invoiceId/edit' | './invoicesId/edit/'
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string }>()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string }>()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string }>()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string }>()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string }>()

  defaultRouterLinkParams.returns.toEqualTypeOf<{ invoiceId: string }>()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<{ invoiceId: string }>()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId: string
  }>()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId: string
  }>()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId: string
  }>()

  defaultRouterLinkParams.parameter(0).toEqualTypeOf<{}>()

  defaultRouterObjectsLinkParams.parameter(0).toEqualTypeOf<{}>()

  routerAlwaysTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{}>()

  routerNeverTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{}>()

  routerPreserveTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{}>()
})

test('when navigating from a route to a route with the same params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    '/invoices/$invoiceId',
    './edit'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/invoices/$invoiceId',
    './edit'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/invoices/$invoiceId',
    './edit/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/$invoiceId',
    './edit'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/$invoiceId',
    './edit' | './edit/'
  >

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined } | undefined>()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined } | undefined>()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined } | undefined>()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined } | undefined>()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined } | undefined>()

  defaultRouterLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string | undefined
  }>()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string | undefined
  }>()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string | undefined
  }>()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string | undefined
  }>()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string | undefined
  }>()

  defaultRouterLinkParams.parameter(0).toEqualTypeOf<{ invoiceId: string }>()

  defaultRouterObjectsLinkParams
    .parameter(0)
    .toEqualTypeOf<{ invoiceId: string }>()

  routerAlwaysTrailingSlashesLinkParams
    .parameter(0)
    .toEqualTypeOf<{ invoiceId: string }>()

  routerNeverTrailingSlashesLinkParams
    .parameter(0)
    .toEqualTypeOf<{ invoiceId: string }>()

  routerPreserveTrailingSlashesLinkParams
    .parameter(0)
    .toEqualTypeOf<{ invoiceId: string }>()
})

test('when navigating from a route with params to a route with different params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    '/invoices/$invoiceId',
    '../../posts/$postId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/invoices/$invoiceId',
    '../../posts/$postId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/invoices/$invoiceId',
    '../../posts/$postId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/$invoiceId',
    '../../posts/$postId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    '/invoices/$invoiceId',
    '../../posts/$postId' | '../../posts/$postId/'
  >

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ postId: string }>()

  defaultRouterLinkParams.returns.toEqualTypeOf<{ postId: string }>()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<{ postId: string }>()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    postId: string
  }>()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    postId: string
  }>()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    postId: string
  }>()

  defaultRouterLinkParams.parameter(0).toEqualTypeOf<{ invoiceId: string }>()

  defaultRouterObjectsLinkParams
    .parameter(0)
    .toEqualTypeOf<{ invoiceId: string }>()

  routerAlwaysTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId: string
  }>()

  routerNeverTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId: string
  }>()

  routerPreserveTrailingSlashesLinkParams
    .parameter(0)
    .toEqualTypeOf<{ invoiceId: string }>()
})

test('when navigating from a route with params to a route with an additional param', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    '/invoices/$invoiceId',
    './details/$detailId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/invoices/$invoiceId',
    './details/$detailId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/invoices/$invoiceId',
    './details/$detailId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/$invoiceId',
    './details/$detailId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    '/invoices/$invoiceId',
    './details/$detailId' | './details/$detailId'
  >

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined; detailId: string }>()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined; detailId: string }>()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined; detailId: string }>()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined; detailId: string }>()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId?: string | undefined; detailId: string }>()

  defaultRouterLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string
    detailId: string
  }>()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string
    detailId: string
  }>()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string
    detailId: string
  }>()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string
    detailId: string
  }>()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<{
    invoiceId?: string
    detailId: string
  }>()
})

test('when navigating to a union of routes with params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit/' | '/posts/$postId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    | '/invoices/$invoiceId/edit'
    | '/invoices/$invoiceId/edit/'
    | '/posts/$postId'
    | '/posts/$postId/'
  >

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ params: unknown }>()

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string } | { postId: string }>()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string } | { postId: string }>()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string } | { postId: string }>()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string } | { postId: string }>()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ invoiceId: string } | { postId: string }>()

  defaultRouterLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string }
  >()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string }
  >()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string }
  >()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string }
  >()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string }
  >()

  defaultRouterLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  defaultRouterObjectsLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerAlwaysTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerNeverTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerPreserveTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()
})

test('when navigating to a union of routes including the root', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/' | '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/' | '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/' | '/invoices/$invoiceId/edit/' | '/posts/$postId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/' | '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    | '/'
    | '/invoices/$invoiceId/edit'
    | '/invoices/$invoiceId/edit/'
    | '/posts/$postId'
    | '/posts/$postId/'
  >

  const defaultRouterLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const defaultRouterObjectsLinkParams = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('params')

  const routerAlwaysTrailingSlashesLinkParams = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerNeverTrailingSlashesLinkParams = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  const routerPreserveTrailingSlashesLinkParams = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('params')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ params: unknown }>()

  defaultRouterLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      { invoiceId: string } | { postId: string } | {} | undefined
    >()

  defaultRouterObjectsLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      { invoiceId: string } | { postId: string } | {} | undefined
    >()

  routerAlwaysTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      { invoiceId: string } | { postId: string } | {} | undefined
    >()

  routerNeverTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      { invoiceId: string } | { postId: string } | {} | undefined
    >()

  routerPreserveTrailingSlashesLinkParams
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      { invoiceId: string } | { postId: string } | {} | undefined
    >()

  defaultRouterLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string } | {}
  >()

  defaultRouterObjectsLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string } | {}
  >()

  routerAlwaysTrailingSlashesLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string } | {}
  >()

  routerNeverTrailingSlashesLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string } | {}
  >()

  routerPreserveTrailingSlashesLinkParams.returns.toEqualTypeOf<
    { invoiceId: string } | { postId: string } | {}
  >()

  defaultRouterLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  defaultRouterObjectsLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerAlwaysTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerNeverTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()

  routerPreserveTrailingSlashesLinkParams.parameter(0).toEqualTypeOf<{
    invoiceId?: string
    postId?: string
    detailId?: string
  }>()
})

test('when navigating from a route with search params to the same route', () => {
  const DefaultRouterLink = Link<DefaultRouter, '/invoices/$invoiceId', string>

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/invoices/$invoiceId',
    string
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/invoices/$invoiceId',
    string
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/$invoiceId',
    string
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/$invoiceId',
    string
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .extract<boolean>()
    .toEqualTypeOf<true>()
})

test('when navigating to a route with search params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/invoices/$invoiceId/edit'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouter,
    string,
    '/invoices/$invoiceId/edit'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit' | '/invoices/$invoiceId/edit/'
  >

  const defaultRouterLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const defaultRouterObjectsLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const routerAlwaysTrailingSlashesLinkSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerNeverTrailingSlashesLinkSearch = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerPreserveTrailingSlashesLinkSearch = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  defaultRouterLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; page?: number; editId: number }>()

  defaultRouterObjectsLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; page?: number; editId: number }>()

  routerAlwaysTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; page?: number; editId: number }>()

  routerNeverTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; page?: number; editId: number }>()

  routerPreserveTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; page?: number; editId: number }>()

  defaultRouterLinkSearch.returns.toEqualTypeOf<{
    page?: number
    rootPage?: number
    editId: number
  }>()

  defaultRouterObjectsLinkSearch.returns.toEqualTypeOf<{
    page?: number
    rootPage?: number
    editId: number
  }>()

  routerAlwaysTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    page?: number
    rootPage?: number
    editId: number
  }>()

  routerNeverTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  routerPreserveTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    page?: number
    rootPage?: number
    editId: number
  }>()

  defaultRouterLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  defaultRouterObjectsLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerAlwaysTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerNeverTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerPreserveTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()
})

test('when navigating to a route with optional search params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/invoices/$invoiceId/details/$detailId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/invoices/$invoiceId/details/$detailId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/invoices/$invoiceId/details/$detailId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/invoices/$invoiceId/details/$detailId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    | '/invoices/$invoiceId/details/$detailId'
    | '/invoices/$invoiceId/details/$detailId/'
  >

  const defaultRouterLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const defaultRouterObjectsLinkSearch = expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')

  const routerAlwaysTrailingSlashesLinkSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerNeverTrailingSlashesLinkSearch = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerPreserveTrailingSlashesLinkSearch = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  defaultRouterLinkSearch.exclude<Function | boolean>().toEqualTypeOf<
    | {
        rootPage?: number
        page?: number
      }
    | undefined
  >()

  defaultRouterObjectsLinkSearch.exclude<Function | boolean>().toEqualTypeOf<
    | {
        rootPage?: number
        page?: number
      }
    | undefined
  >()

  routerAlwaysTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | {
          rootPage?: number
          page?: number
        }
      | undefined
    >()

  routerNeverTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | {
          rootPage?: number
          page?: number
        }
      | undefined
    >()

  routerPreserveTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | {
          rootPage?: number
          page?: number
        }
      | undefined
    >()

  defaultRouterLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
  }>()

  defaultRouterObjectsLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
  }>()

  routerAlwaysTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
  }>()

  routerNeverTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
  }>()

  routerPreserveTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
  }>()

  defaultRouterLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  defaultRouterObjectsLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerAlwaysTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerNeverTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerPreserveTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()
})

test('when navigating from a route with no search params to a route with search params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    '/invoices/',
    './$invoiceId/edit'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    '/invoices/',
    './$invoiceId/edit'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/invoices/',
    './$invoiceId/edit/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/invoices/',
    './$invoiceId/edit'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    '/invoices/',
    './$invoiceId/edit/' | './$invoiceId/edit'
  >

  const defaultRouterLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const defaultRouterObjectsLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const routerAlwaysTrailingSlashesLinkSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerNeverTrailingSlashesLinkSearch = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerPreserveTrailingSlashesLinkSearch = expectTypeOf(
    RouterPreserveTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  defaultRouterLinkSearch.exclude<Function | boolean>().toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  defaultRouterObjectsLinkSearch.exclude<Function | boolean>().toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  routerAlwaysTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      rootPage?: number
      page?: number
      editId: number
    }>()

  routerNeverTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      rootPage?: number
      page?: number
      editId: number
    }>()

  defaultRouterLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  defaultRouterObjectsLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  routerAlwaysTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  routerNeverTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  routerPreserveTrailingSlashesLinkSearch.returns.toEqualTypeOf<{
    rootPage?: number
    page?: number
    editId: number
  }>()

  defaultRouterLinkSearch.parameter(0).toEqualTypeOf<{ rootPage?: number }>()

  defaultRouterObjectsLinkSearch
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  routerAlwaysTrailingSlashesLinkSearch
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  routerNeverTrailingSlashesLinkSearch
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()

  routerPreserveTrailingSlashesLinkSearch
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number }>()
})

test('when navigating to a union of routes with search params', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit/' | '/posts/$postId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    | '/invoices/$invoiceId/edit'
    | '/posts/$postId'
    | '/invoices/$invoiceId/edit/'
    | '/posts/$postId/'
  >

  const defaultRouterLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const defaultRouterObjectsLinkSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const routerAlwaysTrailingSlashesSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerNeverTrailingSlashesSearch = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerPreserveTrailingSlashesSearch = expectTypeOf(
    RouterNeverTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  defaultRouterLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number }
      | undefined
    >()

  defaultRouterObjectsLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number }
      | undefined
    >()

  routerAlwaysTrailingSlashesSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number }
      | undefined
    >()

  routerNeverTrailingSlashesSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number }
      | undefined
    >()

  routerPreserveTrailingSlashesSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number }
      | undefined
    >()

  defaultRouterLinkSearch.returns.toEqualTypeOf<
    { rootPage?: number; page?: number; editId: number } | { rootPage?: number }
  >()

  defaultRouterObjectsLinkSearch.returns.toEqualTypeOf<
    { rootPage?: number; page?: number; editId: number } | { rootPage?: number }
  >()

  routerAlwaysTrailingSlashesSearch.returns.toEqualTypeOf<
    { rootPage?: number; page?: number; editId: number } | { rootPage?: number }
  >()

  routerNeverTrailingSlashesSearch.returns.toEqualTypeOf<
    { rootPage?: number; page?: number; editId: number } | { rootPage?: number }
  >()

  routerPreserveTrailingSlashesSearch.returns.toEqualTypeOf<
    { rootPage?: number; page?: number; editId: number } | { rootPage?: number }
  >()

  defaultRouterLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  defaultRouterObjectsLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerAlwaysTrailingSlashesSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerNeverTrailingSlashesSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerPreserveTrailingSlashesSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()
})

test('when navigating to a union of routes with search params including the root', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/' | '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/' | '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/' | '/invoices/$invoiceId/edit/' | '/posts/$postId/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/' | '/invoices/$invoiceId/edit' | '/posts/$postId'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    | '/'
    | '/invoices/$invoiceId/edit'
    | '/posts/$postId'
    | '/invoices/$invoiceId/edit/'
    | '/posts/$postId/'
  >

  const defaultRouterSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const defaultRouterObjectsSearch = expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')

  const routerAlwaysTrailingSlashesLinkSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerNeverTrailingSlashesLinkSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  const routerPreserveTrailingSlashesLinkSearch = expectTypeOf(
    RouterAlwaysTrailingSlashesLink,
  )
    .parameter(0)
    .toHaveProperty('search')

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .not.toMatchTypeOf<{ search: unknown }>()

  defaultRouterSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number }
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number; rootIndexPage: number }
      | undefined
    >()

  defaultRouterObjectsSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number }
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number; rootIndexPage: number }
      | undefined
    >()

  routerAlwaysTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number }
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number; rootIndexPage: number }
      | undefined
    >()

  routerNeverTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number }
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number; rootIndexPage: number }
      | undefined
    >()

  routerPreserveTrailingSlashesLinkSearch
    .exclude<Function | boolean>()
    .toEqualTypeOf<
      | { rootPage?: number }
      | { rootPage?: number; page?: number; editId: number }
      | { rootPage?: number; rootIndexPage: number }
      | undefined
    >()

  defaultRouterSearch.returns.toEqualTypeOf<
    | { rootPage?: number; page?: number; editId: number }
    | { rootPage?: number; rootIndexPage: number }
    | { rootPage?: number }
  >()

  defaultRouterObjectsSearch.returns.toEqualTypeOf<
    | { rootPage?: number; page?: number; editId: number }
    | { rootPage?: number; rootIndexPage: number }
    | { rootPage?: number }
  >()

  routerAlwaysTrailingSlashesLinkSearch.returns.toEqualTypeOf<
    | { rootPage?: number; page?: number; editId: number }
    | { rootPage?: number; rootIndexPage: number }
    | { rootPage?: number }
  >()

  routerNeverTrailingSlashesLinkSearch.returns.toEqualTypeOf<
    | { rootPage?: number; page?: number; editId: number }
    | { rootPage?: number; rootIndexPage: number }
    | { rootPage?: number }
  >()

  routerPreserveTrailingSlashesLinkSearch.returns.toEqualTypeOf<
    | { rootPage?: number; page?: number; editId: number }
    | { rootPage?: number; rootIndexPage: number }
    | { rootPage?: number }
  >()

  defaultRouterSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  defaultRouterObjectsSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerAlwaysTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerNeverTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()

  routerPreserveTrailingSlashesLinkSearch.parameter(0).toEqualTypeOf<{
    page?: number
    rootIndexPage?: number
    rootPage?: number
    linesPage?: number
    editId?: number
    mode?: 'new' | 'edit' | 'view'
  }>()
})

test('when navigating from the root to /posts', () => {
  const DefaultRouterLink = Link<DefaultRouter, '/', '/posts'>

  const DefaultRouterObjectsLink = Link<DefaultRouterObjects, '/', '/posts'>

  const RouterAlwaysTrailingSlashesLink = Link<
    RouterAlwaysTrailingSlashes,
    '/',
    '/posts/'
  >

  const RouterNeverTrailingSlashesLink = Link<
    RouterNeverTrailingSlashes,
    '/',
    '/posts'
  >

  const RouterPreserveTrailingSlashesLink = Link<
    RouterPreserveTrailingSlashes,
    '/',
    '/posts' | '/posts/'
  >

  expectTypeOf(DefaultRouterLink).not.toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink).not.toMatchTypeOf<{
    search: unknown
  }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink).not.toMatchTypeOf<{
    search: unknown
  }>()

  expectTypeOf(RouterNeverTrailingSlashesLink).not.toMatchTypeOf<{
    search: unknown
  }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink).not.toMatchTypeOf<{
    search: unknown
  }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number } | undefined>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number } | undefined>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number } | undefined>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number } | undefined>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number } | undefined>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<
      { rootPage?: number } | { rootPage?: number; rootIndexPage: number }
    >()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<
      { rootPage?: number } | { rootPage?: number; rootIndexPage: number }
    >()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<
      { rootPage?: number } | { rootPage?: number; rootIndexPage: number }
    >()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<
      { rootPage?: number } | { rootPage?: number; rootIndexPage: number }
    >()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<
      { rootPage?: number } | { rootPage?: number; rootIndexPage: number }
    >()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(RouterAlwaysTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(RouterNeverTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()

  expectTypeOf(RouterPreserveTrailingSlashesLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number }>()
})

test('when navigating to a route with SearchSchemaInput', () => {
  expectTypeOf(
    Link<
      DefaultRouter,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<
      { rootPage?: number; page?: number; linesPage?: number } | undefined
    >()

  expectTypeOf(
    Link<
      DefaultRouterObjects,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<
      { rootPage?: number; page?: number; linesPage?: number } | undefined
    >()

  expectTypeOf(
    Link<
      RouterAlwaysTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines/'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<
      { rootPage?: number; page?: number; linesPage?: number } | undefined
    >()

  expectTypeOf(
    Link<
      RouterNeverTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<
      { rootPage?: number; page?: number; linesPage?: number } | undefined
    >()

  expectTypeOf(
    Link<
      RouterPreserveTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<
      { rootPage?: number; page?: number; linesPage?: number } | undefined
    >()

  expectTypeOf(
    Link<DefaultRouter, string, '/invoices/$invoiceId/details/$detailId/lines'>,
  )
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      page?: number
      linesPage?: number
    }>()

  expectTypeOf(
    Link<
      DefaultRouterObjects,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      page?: number
      linesPage?: number
    }>()

  expectTypeOf(
    Link<
      RouterAlwaysTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines/'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      page?: number
      linesPage?: number
    }>()

  expectTypeOf(
    Link<
      RouterNeverTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      page?: number
      linesPage?: number
    }>()

  expectTypeOf(
    Link<
      RouterPreserveTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{
      rootPage?: number
      page?: number
      linesPage?: number
    }>()

  expectTypeOf(
    Link<
      DefaultRouter,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number; page?: number; linesPage: number }>()

  expectTypeOf(
    Link<
      DefaultRouterObjects,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number; page?: number; linesPage: number }>()

  expectTypeOf(
    Link<
      RouterAlwaysTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines/'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number; page?: number; linesPage: number }>()

  expectTypeOf(
    Link<
      RouterNeverTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      '/invoices/$invoiceId/details/$detailId/lines/'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number; page?: number; linesPage: number }>()

  expectTypeOf(
    Link<
      RouterPreserveTrailingSlashes,
      '/invoices/$invoiceId/details/$detailId/lines',
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines'
    >,
  )
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ rootPage?: number; page?: number; linesPage: number }>()
})

test('when passing a component with props to createLink and navigating to the root', () => {
  const MyLink = createLink((props: { additionalProps: number }) => (
    <Link {...(props as any)} />
  ))

  const DefaultRouterLink = MyLink<DefaultRouter, string, '/'>
  const DefaultRouterObjectsLink = MyLink<DefaultRouterObjects, string, '/'>
  const RouterAlwaysTrailingSlashLink = MyLink<
    RouterAlwaysTrailingSlashes,
    string,
    '/'
  >
  const RouterNeverTrailingSlashLink = MyLink<
    RouterNeverTrailingSlashes,
    string,
    '/'
  >
  const RouterPreserveTrailingSlashLink = MyLink<
    RouterPreserveTrailingSlashes,
    string,
    '/'
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../'
      | './'
      | '/'
      | '/invoices/'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/edit/'
      | '/posts/'
      | '/posts/$postId/'
    >()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | './'
      | '../'
      | '/'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/edit/'
      | '/posts'
      | '/posts/'
      | '/posts/$postId'
      | '/posts/$postId/'
    >()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'new' | 'edit' | 'view'
    }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('additionalProps')
    .toEqualTypeOf<number>()

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('activeProps')
    .returns.toHaveProperty('additionalProps')
    .toEqualTypeOf<number | undefined>()

  createLink((props) => expectTypeOf(props).toEqualTypeOf<CreateLinkProps>())
})

test('ResolveRelativePath', () => {
  expectTypeOf<ResolveRelativePath<'/', '/posts'>>().toEqualTypeOf<'/posts'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', '..'>
  >().toEqualTypeOf<'/posts/1'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments/', '..'>
  >().toEqualTypeOf<'/posts/1/'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', '../..'>
  >().toEqualTypeOf<'/posts'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments/', '../..'>
  >().toEqualTypeOf<'/posts/'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', '../../..'>
  >().toEqualTypeOf<'/'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', './1'>
  >().toEqualTypeOf<'/posts/1/comments/1'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', './1/2'>
  >().toEqualTypeOf<'/posts/1/comments/1/2'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', '../edit'>
  >().toEqualTypeOf<'/posts/1/edit'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments/', '../edit'>
  >().toEqualTypeOf<'/posts/1/edit'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', '1'>
  >().toEqualTypeOf<'/posts/1/comments/1'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', './1'>
  >().toEqualTypeOf<'/posts/1/comments/1'>()

  expectTypeOf<
    ResolveRelativePath<'/posts/1/comments', './1/2'>
  >().toEqualTypeOf<'/posts/1/comments/1/2'>()
})

test('navigation edge cases', () => {
  expectTypeOf(Link<DefaultRouter, '/', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/', '../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/', '..' | '../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<DefaultRouter, '', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '', '../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '', '..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '', '..' | '../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<DefaultRouter, '/posts', '...'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts', '.../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts', '...'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterPreserveTrailingSlashes, '/posts', '...' | '.../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<DefaultRouter, '/posts/$postId', '../../..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/$postId', '../../../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts/$postId', '../../..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(
    Link<
      RouterPreserveTrailingSlashes,
      '/posts/$postId',
      '../../..' | '../../../'
    >,
  )
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<undefined>()

  expectTypeOf(Link<DefaultRouter, '/posts/$postId', '../..'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../..'
      | '../../posts'
      | '../../posts/$postId'
      | '../../invoices'
      | '../../invoices/$invoiceId'
      | '../../invoices/$invoiceId/edit'
      | '../../invoices/$invoiceId/details'
      | '../../invoices/$invoiceId/details/$detailId'
      | '../../invoices/$invoiceId/details/$detailId/lines'
      | '../../invoices/$invoiceId/details/$detailId/lines/form'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | undefined
    >()

  expectTypeOf(Link<RouterAlwaysTrailingSlashes, '/posts/$postId', '../../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../../'
      | '../../posts/'
      | '../../posts/$postId/'
      | '../../invoices/'
      | '../../invoices/$invoiceId/'
      | '../../invoices/$invoiceId/edit/'
      | '../../invoices/$invoiceId/details/'
      | '../../invoices/$invoiceId/details/$detailId/'
      | '../../invoices/$invoiceId/details/$detailId/lines/'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | undefined
    >()

  expectTypeOf(Link<RouterNeverTrailingSlashes, '/posts/$postId', '../../'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../..'
      | '../../posts'
      | '../../posts/$postId'
      | '../../invoices'
      | '../../invoices/$invoiceId'
      | '../../invoices/$invoiceId/edit'
      | '../../invoices/$invoiceId/details'
      | '../../invoices/$invoiceId/details/$detailId'
      | '../../invoices/$invoiceId/details/$detailId/lines'
      | '../../invoices/$invoiceId/details/$detailId/lines/form'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | undefined
    >()

  expectTypeOf(
    Link<RouterPreserveTrailingSlashes, '/posts/$postId', '../../' | '../..'>,
  )
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../..'
      | '../../'
      | '../../posts'
      | '../../posts/$postId'
      | '../../invoices'
      | '../../invoices/$invoiceId'
      | '../../invoices/$invoiceId/edit'
      | '../../invoices/$invoiceId/details'
      | '../../invoices/$invoiceId/details/$detailId'
      | '../../invoices/$invoiceId/details/$detailId/lines'
      | '../../invoices/$invoiceId/details/$detailId/lines/form'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '../../posts/'
      | '../../posts/$postId/'
      | '../../invoices/'
      | '../../invoices/$invoiceId/'
      | '../../invoices/$invoiceId/edit/'
      | '../../invoices/$invoiceId/details/'
      | '../../invoices/$invoiceId/details/$detailId/'
      | '../../invoices/$invoiceId/details/$detailId/lines/'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/'
      | '../../invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | undefined
    >()
})

test('linkOptions', () => {
  const defaultRouterLinkOptions = linkOptions<
    { label: string; to: '/' },
    DefaultRouter
  >
  const defaultRouterObjectsLinkOptions = linkOptions<
    { label: string; to: '/' },
    DefaultRouter
  >

  const routerAlwaysTrailingSlashLinkOptions = linkOptions<
    { label: string; to: '/' },
    RouterAlwaysTrailingSlashes
  >

  const routerNeverTrailingSlashLinkOptions = linkOptions<
    { label: string; to: '/' },
    RouterNeverTrailingSlashes
  >
  const routerPreserveTrailingSlashLinkOptions = linkOptions<
    { label: string; to: '/' },
    RouterPreserveTrailingSlashes
  >

  expectTypeOf(defaultRouterLinkOptions)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(defaultRouterObjectsLinkOptions)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(routerAlwaysTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '../'
      | './'
      | '/'
      | '/invoices/'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/edit/'
      | '/posts/'
      | '/posts/$postId/'
    >()

  expectTypeOf(routerNeverTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | '/'
      | '/invoices'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/edit'
      | '/posts'
      | '/posts/$postId'
    >()

  expectTypeOf(routerPreserveTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '.'
      | './'
      | '../'
      | '/'
      | '/invoices'
      | '/invoices/'
      | '/invoices/$invoiceId'
      | '/invoices/$invoiceId/'
      | '/invoices/$invoiceId/details/$detailId'
      | '/invoices/$invoiceId/details/$detailId/'
      | '/invoices/$invoiceId/details/$detailId/lines'
      | '/invoices/$invoiceId/details/$detailId/lines/'
      | '/invoices/$invoiceId/details/$detailId/lines/form'
      | '/invoices/$invoiceId/details/$detailId/lines/form/'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
      | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
      | '/invoices/$invoiceId/details'
      | '/invoices/$invoiceId/details/'
      | '/invoices/$invoiceId/edit'
      | '/invoices/$invoiceId/edit/'
      | '/posts'
      | '/posts/'
      | '/posts/$postId'
      | '/posts/$postId/'
    >()

  expectTypeOf(defaultRouterLinkOptions)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(defaultRouterObjectsLinkOptions)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(routerAlwaysTrailingSlashLinkOptions)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(routerNeverTrailingSlashLinkOptions)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(routerPreserveTrailingSlashLinkOptions)
    .parameter(0)
    .toMatchTypeOf<{ search: unknown }>()

  expectTypeOf(defaultRouterLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(defaultRouterObjectsLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(routerAlwaysTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(routerNeverTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(routerPreserveTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(defaultRouterLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'view' | 'edit' | 'new'
    }>()

  expectTypeOf(defaultRouterObjectsLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'view' | 'edit' | 'new'
    }>()

  expectTypeOf(routerAlwaysTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'view' | 'edit' | 'new'
    }>()

  expectTypeOf(routerNeverTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'view' | 'edit' | 'new'
    }>()

  expectTypeOf(routerPreserveTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{
      page?: number
      rootIndexPage?: number
      rootPage?: number
      linesPage?: number
      editId?: number
      mode?: 'edit' | 'view' | 'new'
    }>()

  expectTypeOf(defaultRouterLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(defaultRouterObjectsLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(routerAlwaysTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(routerNeverTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(routerPreserveTrailingSlashLinkOptions)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ rootPage?: number; rootIndexPage: number }>()

  expectTypeOf(defaultRouterLinkOptions).returns.toEqualTypeOf<{
    label: string
    to: '/'
  }>()

  expectTypeOf(defaultRouterObjectsLinkOptions).returns.toEqualTypeOf<{
    label: string
    to: '/'
  }>()

  expectTypeOf(routerAlwaysTrailingSlashLinkOptions).returns.toEqualTypeOf<{
    label: string
    to: '/'
  }>()

  expectTypeOf(routerNeverTrailingSlashLinkOptions).returns.toEqualTypeOf<{
    label: string
    to: '/'
  }>()

  expectTypeOf(routerPreserveTrailingSlashLinkOptions).returns.toEqualTypeOf<{
    label: string
    to: '/'
  }>()
})

test('when navigating to a route with conflicting validateSearch', () => {
  const DefaultRouterLink = Link<
    DefaultRouter,
    string,
    '/invoices/$invoiceId/details/$detailId/lines/form/edit'
  >

  const DefaultRouterObjectsLink = Link<
    DefaultRouterObjects,
    string,
    '/invoices/$invoiceId/details/$detailId/lines/form/edit'
  >

  const RouterAlwaysTrailingSlashLink = Link<
    RouterAlwaysTrailingSlashes,
    string,
    '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
  >

  const RouterNeverTrailingSlashLink = Link<
    RouterNeverTrailingSlashes,
    string,
    '/invoices/$invoiceId/details/$detailId/lines/form/edit'
  >
  const RouterPreserveTrailingSlashLink = Link<
    RouterPreserveTrailingSlashes,
    string,
    | '/invoices/$invoiceId/details/$detailId/lines/form/edit/'
    | '/invoices/$invoiceId/details/$detailId/lines/form/edit'
  >

  expectTypeOf(DefaultRouterLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      mode: 'edit' | 'view'
      linesPage?: number | undefined
      page?: number | undefined
      rootPage?: number | undefined
    }>()

  expectTypeOf(DefaultRouterObjectsLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      mode: 'edit' | 'view'
      linesPage?: number | undefined
      page?: number | undefined
      rootPage?: number | undefined
    }>()

  expectTypeOf(RouterAlwaysTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      mode: 'edit' | 'view'
      linesPage?: number | undefined
      page?: number | undefined
      rootPage?: number | undefined
    }>()

  expectTypeOf(RouterNeverTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      mode: 'edit' | 'view'
      linesPage?: number | undefined
      page?: number | undefined
      rootPage?: number | undefined
    }>()

  expectTypeOf(RouterPreserveTrailingSlashLink)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | boolean>()
    .toEqualTypeOf<{
      mode: 'edit' | 'view'
      linesPage?: number | undefined
      page?: number | undefined
      rootPage?: number | undefined
    }>()
})
