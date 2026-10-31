import {
  Link,
  createRouter,
  redirect,
  useLoaderData,
  useLoaderDeps,
  useMatch,
  useNavigate,
  useParams,
  useRouteContext,
  useSearch,
} from '@tanstack/react-router'
import type { FileRoutesByPath, MakeRouteMatch } from '@tanstack/react-router'
import { expectTypeOf, test } from 'vitest'
import { routeTree } from './routeTree.gen'
import type { FileRouteTypes } from './routeTree.gen'

const defaultRouter = createRouter({
  routeTree,
})

type DefaultRouter = typeof defaultRouter

const alwaysTrailingSlashRouter = createRouter({
  routeTree,
  trailingSlash: 'always',
})

const neverTrailingSlashRouter = createRouter({
  routeTree,
  trailingSlash: 'never',
})

const preserveTrailingSlashRouter = createRouter({
  routeTree,
  trailingSlash: 'preserve',
})

test('when navigating to the root', () => {
  // Issue #4892: Pathless layout routes should have fullPath: '/' not ''
  expectTypeOf<FileRoutesByPath['/']['fullPath']>().toEqualTypeOf<'/'>()
  expectTypeOf<
    FileRoutesByPath['/posts/']['fullPath']
  >().toEqualTypeOf<'/posts/'>()
  // Issue #6403: Index routes should have trailing slash in fullPath to match runtime
  expectTypeOf<
    FileRoutesByPath['/posts/$postId/']['fullPath']
  >().toEqualTypeOf<'/posts/$postId/'>()
  expectTypeOf<
    FileRoutesByPath['/blog/']['fullPath']
  >().toEqualTypeOf<'/blog/'>()
  // Verify empty string is not in fullPaths union
  expectTypeOf<''>().not.toMatchTypeOf<FileRouteTypes['fullPaths']>()
  // Verify pathless layout's fullPath is '/' (not '')
  expectTypeOf<
    FileRoutesByPath['/_pathlessLayout']['fullPath']
  >().toEqualTypeOf<'/'>()
  // Child of pathless layout should have correct fullPath
  expectTypeOf<
    FileRoutesByPath['/_pathlessLayout/settings']['fullPath']
  >().toEqualTypeOf<'/settings'>()

  expectTypeOf(Link<typeof defaultRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/settings'
      | undefined
    >()

  expectTypeOf(Link<typeof alwaysTrailingSlashRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/blog/'
      | '/posts/'
      | '/blog/$blogId/'
      | '/blog/$blogId/edit/'
      | '/blog/$blogId/$slug/'
      | '/blog/$blogId/$slug/bar/'
      | '/blog/$slug/'
      | '/blog/stats/'
      | '/posts/$postId/deep/'
      | '/posts/$postId/'
      | '/settings/'
      | undefined
    >()

  expectTypeOf(Link<typeof neverTrailingSlashRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/settings'
      | undefined
    >()

  expectTypeOf(Link<typeof preserveTrailingSlashRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/blog/'
      | '/posts/'
      | '/blog/$blogId/'
      | '/blog/$blogId/edit/'
      | '/blog/$blogId/$slug/'
      | '/blog/$blogId/$slug/bar/'
      | '/blog/$slug/'
      | '/blog/stats/'
      | '/posts/$postId/deep/'
      | '/posts/$postId/'
      | '/settings/'
      | '/settings'
      | undefined
    >()

  expectTypeOf(Link<typeof defaultRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/settings'
      | undefined
    >()

  expectTypeOf(Link<typeof defaultRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<true | {} | undefined>()

  expectTypeOf(Link<typeof alwaysTrailingSlashRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<true | {} | undefined>()

  expectTypeOf(Link<typeof neverTrailingSlashRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<true | {} | undefined>()

  expectTypeOf(Link<typeof preserveTrailingSlashRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<true | {} | undefined>()
})

test('when navigating a index route with search and params', () => {
  expectTypeOf(Link<typeof defaultRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '.'
      | '..'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/settings'
    >()

  expectTypeOf(
    Link<typeof alwaysTrailingSlashRouter, string, '/posts/$postId/'>,
  )
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | './'
      | '../'
      | '/'
      | '/blog/'
      | '/posts/'
      | '/blog/$blogId/'
      | '/blog/$blogId/edit/'
      | '/blog/$blogId/$slug/'
      | '/blog/$blogId/$slug/bar/'
      | '/blog/$slug/'
      | '/blog/stats/'
      | '/posts/$postId/deep/'
      | '/posts/$postId/'
      | '/settings/'
    >()

  expectTypeOf(Link<typeof neverTrailingSlashRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/settings'
      | '.'
      | '..'
    >()

  expectTypeOf(
    Link<typeof preserveTrailingSlashRouter, string, '/posts/$postId'>,
  )
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '..'
      | '../'
      | '.'
      | './'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/blog/'
      | '/posts/'
      | '/blog/$blogId/'
      | '/blog/$blogId/edit/'
      | '/blog/$blogId/$slug/'
      | '/blog/$blogId/$slug/bar/'
      | '/blog/$slug/'
      | '/blog/stats/'
      | '/posts/$postId/deep/'
      | '/posts/$postId/'
      | '/settings'
      | '/settings/'
    >()

  expectTypeOf(Link<typeof defaultRouter, '/', '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/settings'
      | undefined
    >()

  expectTypeOf(Link<typeof defaultRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ indexSearch: string }>()

  expectTypeOf(Link<typeof defaultRouter, string, '/posts/$postId/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<never>()

  expectTypeOf(
    Link<typeof alwaysTrailingSlashRouter, string, '/posts/$postId/'>,
  )
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ indexSearch: string }>()

  expectTypeOf(Link<typeof alwaysTrailingSlashRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<never>()

  expectTypeOf(Link<typeof neverTrailingSlashRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ indexSearch: string }>()

  expectTypeOf(Link<typeof preserveTrailingSlashRouter, '/', '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ indexSearch: string }>()

  expectTypeOf(Link<typeof preserveTrailingSlashRouter, '/', '/posts/$postId/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ indexSearch: string }>()

  expectTypeOf(Link<typeof defaultRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ postId: string }>()

  expectTypeOf(Link<typeof defaultRouter, string, '/posts/$postId/'>)
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<never>()

  expectTypeOf(
    Link<typeof alwaysTrailingSlashRouter, string, '/posts/$postId/'>,
  )
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ postId: string }>()

  expectTypeOf(Link<typeof alwaysTrailingSlashRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<never>()

  expectTypeOf(Link<typeof neverTrailingSlashRouter, string, '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ postId: string }>()

  expectTypeOf(Link<typeof preserveTrailingSlashRouter, '/', '/posts/$postId'>)
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ postId: string }>()

  expectTypeOf(Link<typeof preserveTrailingSlashRouter, '/', '/posts/$postId/'>)
    .parameter(0)
    .toHaveProperty('params')
    .exclude<(...args: any) => any>()
    .toEqualTypeOf<{ postId: string }>()
})

test('when navigating from a index route with search and params', () => {
  expectTypeOf(Link<typeof defaultRouter, '/posts/$postId/', undefined>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId/'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/settings'
      | undefined
    >()

  expectTypeOf(Link<typeof defaultRouter, '/posts/$postId/', undefined>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ indexSearch: string }>()
})

test('when using useNavigate', () => {
  const navigate = useNavigate()

  expectTypeOf(navigate<DefaultRouter, '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '.'
      | '..'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/posts/$postId'
      | '/settings'
    >()
})

test('when using redirect', () => {
  expectTypeOf(redirect<DefaultRouter, '/', '/'>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<
      | '/'
      | '/posts/$postId'
      | '/blog'
      | '/posts'
      | '/blog/$blogId'
      | '/blog/$blogId/edit'
      | '/blog/$blogId/$slug'
      | '/blog/$blogId/$slug/bar'
      | '/blog/$slug'
      | '/blog/stats'
      | '/posts/$postId/deep'
      | '/settings'
      | undefined
    >()
})

test('when using useSearch from a route with no search', () => {
  expectTypeOf(useSearch<DefaultRouter, '/blog'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(useSearch<DefaultRouter, '/blog'>).returns.toEqualTypeOf<{}>()
})

test('when using useSearch from a route with search', () => {
  expectTypeOf(useSearch<DefaultRouter, '/blog'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(
    useSearch<DefaultRouter, '/posts/$postId/'>,
  ).returns.toEqualTypeOf<{ indexSearch: string }>()
})

test('when using useLoaderData from a route with loaderData', () => {
  expectTypeOf(useLoaderData<DefaultRouter, '/posts/$postId/deep'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(
    useLoaderData<DefaultRouter, '/posts/$postId/deep'>,
  ).returns.toEqualTypeOf<{ data: string }>()
})

test('when using useLoaderDeps from a route with loaderDeps', () => {
  expectTypeOf(useLoaderDeps<DefaultRouter, '/posts/$postId/deep'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(
    useLoaderDeps<DefaultRouter, '/posts/$postId/deep'>,
  ).returns.toEqualTypeOf<{ dep: number }>()
})

test('when using useMatch from a route', () => {
  expectTypeOf(useMatch<DefaultRouter, '/posts/$postId/deep'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(
    useMatch<DefaultRouter, '/posts/$postId/deep'>,
  ).returns.toEqualTypeOf<
    MakeRouteMatch<DefaultRouter['routeTree'], '/posts/$postId/deep', true>
  >()
})

test('when using useParams from a route', () => {
  expectTypeOf(useParams<DefaultRouter, '/posts/$postId/deep'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(
    useParams<DefaultRouter, '/posts/$postId/deep'>,
  ).returns.toEqualTypeOf<{ postId: string }>()
})

test('when using useRouteContext from a route', () => {
  expectTypeOf(useRouteContext<DefaultRouter, '/posts/$postId/deep'>)
    .parameter(0)
    .toHaveProperty('from')
    .toEqualTypeOf<
      | '__root__'
      | '/'
      | '/blog'
      | '/posts'
      | '/blog/$slug'
      | '/blog_/$blogId'
      | '/blog_/$blogId_/edit'
      | '/blog_/$blogId/$slug'
      | '/blog_/$blogId/$slug_/bar'
      | '/blog_/stats'
      | '/blog/'
      | '/posts/'
      | '/posts/$postId/deep'
      | '/posts/$postId/'
      | '/_pathlessLayout'
      | '/_pathlessLayout/settings'
    >()

  expectTypeOf(
    useRouteContext<DefaultRouter, '/posts/$postId/deep'>,
  ).returns.toEqualTypeOf<{ someContext: string }>()
})
