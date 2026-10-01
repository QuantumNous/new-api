import { expectTypeOf, test } from 'vitest'
import {
  MatchRoute,
  createRootRoute,
  createRoute,
  createRouter,
  isMatch,
  useMatchRoute,
  useMatches,
} from '../src'
import type { AnyRouteMatch, RouteMatch } from '@tanstack/router-core'
import type * as Vue from 'vue'

const rootRoute = createRootRoute()

type RootRoute = typeof rootRoute

type RootMatch = RouteMatch<
  RootRoute['id'],
  RootRoute['fullPath'],
  RootRoute['types']['allParams'],
  RootRoute['types']['fullSearchSchema'],
  RootRoute['types']['loaderData'],
  RootRoute['types']['allContext'],
  RootRoute['types']['loaderDeps']
>

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

type IndexRoute = typeof indexRoute

type IndexMatch = RouteMatch<
  IndexRoute['id'],
  IndexRoute['fullPath'],
  IndexRoute['types']['allParams'],
  IndexRoute['types']['fullSearchSchema'],
  IndexRoute['types']['loaderData'],
  IndexRoute['types']['allContext'],
  IndexRoute['types']['loaderDeps']
>

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'invoices',
  loader: () => [{ id: '1' }, { id: '2' }],
})

type InvoiceMatch = RouteMatch<
  InvoiceRoute['id'],
  InvoiceRoute['fullPath'],
  InvoiceRoute['types']['allParams'],
  InvoiceRoute['types']['fullSearchSchema'],
  InvoiceRoute['types']['loaderData'],
  InvoiceRoute['types']['allContext'],
  InvoiceRoute['types']['loaderDeps']
>

type InvoicesRoute = typeof invoicesRoute

type InvoicesMatch = RouteMatch<
  InvoicesRoute['id'],
  InvoicesRoute['fullPath'],
  InvoicesRoute['types']['allParams'],
  InvoicesRoute['types']['fullSearchSchema'],
  InvoicesRoute['types']['loaderData'],
  InvoicesRoute['types']['allContext'],
  InvoicesRoute['types']['loaderDeps']
>

const invoicesIndexRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '/',
})

type InvoicesIndexRoute = typeof invoicesIndexRoute

type InvoicesIndexMatch = RouteMatch<
  InvoicesIndexRoute['id'],
  InvoicesIndexRoute['fullPath'],
  InvoicesIndexRoute['types']['allParams'],
  InvoicesIndexRoute['types']['fullSearchSchema'],
  InvoicesIndexRoute['types']['loaderData'],
  InvoicesIndexRoute['types']['allContext'],
  InvoicesIndexRoute['types']['loaderDeps']
>

const invoiceRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '$invoiceId',
  validateSearch: () => ({ page: 0 }),
})

type InvoiceRoute = typeof invoiceRoute

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
})

type LayoutRoute = typeof layoutRoute

type LayoutMatch = RouteMatch<
  LayoutRoute['id'],
  LayoutRoute['fullPath'],
  LayoutRoute['types']['allParams'],
  LayoutRoute['types']['fullSearchSchema'],
  LayoutRoute['types']['loaderData'],
  LayoutRoute['types']['allContext'],
  LayoutRoute['types']['loaderDeps']
>

const commentsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'comments/$id',
  validateSearch: () => ({
    page: 0,
    search: '',
  }),
  loader: () =>
    [{ comment: 'one comment' }, { comment: 'two comment' }] as const,
})

type CommentsRoute = typeof commentsRoute

type CommentsMatch = RouteMatch<
  CommentsRoute['id'],
  CommentsRoute['fullPath'],
  CommentsRoute['types']['allParams'],
  CommentsRoute['types']['fullSearchSchema'],
  CommentsRoute['types']['loaderData'],
  CommentsRoute['types']['allContext'],
  CommentsRoute['types']['loaderDeps']
>

const routeTree = rootRoute.addChildren([
  invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
  indexRoute,
  layoutRoute.addChildren([commentsRoute]),
])

const defaultRouter = createRouter({
  routeTree,
})

type DefaultRouter = typeof defaultRouter

const useDefaultMatchRoute = useMatchRoute<DefaultRouter>

test('when matching a route with params', () => {
  const matchRoute = useDefaultMatchRoute()

  expectTypeOf(matchRoute<string, '/invoices/$invoiceId'>)
    .parameter(0)
    .toHaveProperty('to')

  expectTypeOf(MatchRoute<DefaultRouter, string, '/invoices/$invoiceId'>)
    .parameter(0)
    .toHaveProperty('to')

  const result = matchRoute({
    to: '/invoices/$invoiceId',
  })
  expectTypeOf(result).toMatchTypeOf<Vue.Ref<false | { invoiceId: string }>>()
})

test('when matching a route with params underneath a layout route', () => {
  const matchRoute = useDefaultMatchRoute()

  const result = matchRoute({
    to: '/comments/$id',
  })
  expectTypeOf(result).toMatchTypeOf<Vue.Ref<false | { id: string }>>()
})

test('useMatches returns a union of all matches', () => {
  expectTypeOf(useMatches<DefaultRouter>().value).toEqualTypeOf<
    Array<
      | RootMatch
      | IndexMatch
      | InvoicesMatch
      | InvoicesIndexMatch
      | InvoiceMatch
      | LayoutMatch
      | CommentsMatch
    >
  >
})

test('when filtering useMatches by search', () => {
  const matches = useMatches<DefaultRouter>().value

  expectTypeOf(isMatch<(typeof matches)[number], ''>)
    .parameter(1)
    .toEqualTypeOf<keyof AnyRouteMatch>()

  expectTypeOf(isMatch<(typeof matches)[number], 'search.'>).parameter(1)
    .toEqualTypeOf<'search.page' | 'search.search'>

  expectTypeOf(
    matches.filter((match) => isMatch(match, 'search.page')),
  ).toEqualTypeOf<Array<InvoiceMatch | CommentsMatch>>()
})

test('when filtering useMatches by loaderData with an array', () => {
  const matches = useMatches<DefaultRouter>().value

  expectTypeOf(isMatch<(typeof matches)[number], ''>)
    .parameter(1)
    .toEqualTypeOf<keyof AnyRouteMatch>()

  expectTypeOf(isMatch<(typeof matches)[number], 'loaderData.'>)
    .parameter(1)
    .toEqualTypeOf<'loaderData.0' | 'loaderData.1' | `loaderData.${number}`>()

  expectTypeOf(isMatch<(typeof matches)[number], 'loaderData.0.'>).parameter(1)
    .toEqualTypeOf<'loaderData.0.id' | 'loaderData.0.comment'>

  expectTypeOf(
    matches.filter((match) => isMatch(match, 'loaderData.5.id')),
  ).toEqualTypeOf<Array<InvoicesMatch>>()

  expectTypeOf(
    matches.filter((match) => isMatch(match, 'loaderData.0.comment')),
  ).toEqualTypeOf<Array<CommentsMatch>>()
})
