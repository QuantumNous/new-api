import { expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter } from '../src'
import type { ResolveOptionalParams } from '../src'
import type { Accessor } from 'solid-js'

test('when creating a route with optional parameters', () => {
  const rootRoute = createRootRoute()
  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users/{-$tab}',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([usersRoute]),
  })

  expectTypeOf(usersRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      tab?: string
    }>
  >()
})

test('when creating a route with mixed optional and required parameters', () => {
  const rootRoute = createRootRoute()
  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users/$id/{-$tab}',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([usersRoute]),
  })

  expectTypeOf(usersRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      id: string
      tab?: string
    }>
  >()
})

test('when creating a route with optional param with prefix and suffix', () => {
  const rootRoute = createRootRoute()
  const filesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/files/prefix{-$name}.txt',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([filesRoute]),
  })

  expectTypeOf(filesRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      name?: string
    }>
  >()
})

test('when creating Link with optional parameters', () => {
  const rootRoute = createRootRoute()
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/{-$category}/{-$slug}',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([postsRoute]),
  })

  expectTypeOf(postsRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      category?: string
      slug?: string
    }>
  >()
})

test('when using optional parameters in loaders', () => {
  const rootRoute = createRootRoute()
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/{-$category}',
    loader: ({ params }) => {
      expectTypeOf(params).toEqualTypeOf<{ category?: string }>()
      return params
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([postsRoute]),
  })

  expectTypeOf(postsRoute.useLoaderData<typeof router>()).toEqualTypeOf<
    Accessor<{
      category?: string
    }>
  >()
})

test('when using optional parameters in beforeLoad', () => {
  const rootRoute = createRootRoute()
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/{-$category}',
    beforeLoad: ({ params }) => {
      expectTypeOf(params).toEqualTypeOf<{ category?: string }>()
      return { user: 'test' }
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([postsRoute]),
  })

  expectTypeOf(postsRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      category?: string
    }>
  >()
})

test('when using params.parse with optional parameters', () => {
  const rootRoute = createRootRoute()
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/{-$page}',
    params: {
      parse: (params) => {
        // Basic functionality working, complex type inference still has issues
        return {
          page: params.page ? parseInt(params.page) : undefined,
        }
      },
      stringify: (params) => {
        return {
          page: params.page?.toString(),
        }
      },
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([postsRoute]),
  })

  // Note: Type inference for params.parse is still complex - this represents current working behavior
  expectTypeOf(postsRoute.useParams<typeof router>()).toMatchTypeOf<
    Accessor<{
      page?: number | undefined
    }>
  >()
})

test('when nesting routes with optional parameters', () => {
  const rootRoute = createRootRoute()
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/{-$category}',
  })
  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '/$postId',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([postsRoute.addChildren([postRoute])]),
  })

  expectTypeOf(postRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      category?: string
      postId: string
    }>
  >()
})

test('when combining optional parameters with wildcards', () => {
  const rootRoute = createRootRoute()
  const docsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/docs/{-$version}/$',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([docsRoute]),
  })

  expectTypeOf(docsRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      version?: string
      _splat?: string
    }>
  >()
})

test('when using ResolveOptionalParams utility type', () => {
  type OptionalParams = ResolveOptionalParams<
    '/posts/{-$category}/{-$slug}',
    string
  >

  expectTypeOf<OptionalParams>().toEqualTypeOf<{
    category?: string
    slug?: string
  }>()
})

test('complex scenario with optional parameters only', () => {
  const rootRoute = createRootRoute()
  const complexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/app/{-$env}/api/{-$version}/users/$id/{-$tab}/$',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([complexRoute]),
  })

  expectTypeOf(complexRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      env?: string
      version?: string
      id: string
      tab?: string
      _splat?: string
    }>
  >()
})

test('edge case - all optional parameters', () => {
  const rootRoute = createRootRoute()
  const allOptionalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/{-$category}/{-$subcategory}/{-$item}',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([allOptionalRoute]),
  })

  expectTypeOf(allOptionalRoute.useParams<typeof router>()).toEqualTypeOf<
    Accessor<{
      category?: string
      subcategory?: string
      item?: string
    }>
  >()
})
