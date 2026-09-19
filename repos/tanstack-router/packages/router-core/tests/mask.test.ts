import { describe, expect, test } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import { BaseRootRoute, BaseRoute } from '../src'
import { createTestRouter } from './routerTestUtils'
import type { RouteMask } from '../src'

describe('buildLocation - route masks', () => {
  const setup = (routeMasks?: Array<RouteMask<any>>) => {
    const rootRoute = new BaseRootRoute({})
    const photoRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/photos/$photoId',
    })

    const modalRoute = new BaseRoute({
      getParentRoute: () => photoRoute,
      path: '/modal',
    })

    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const postRoute = new BaseRoute({
      getParentRoute: () => postsRoute,
      path: '/$postId',
    })

    const infoRoute = new BaseRoute({
      getParentRoute: () => postRoute,
      path: '/info',
    })

    const routeTree = rootRoute.addChildren([
      photoRoute.addChildren([modalRoute]),
      postsRoute.addChildren([postRoute.addChildren([infoRoute])]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
      routeMasks,
    })

    return router
  }

  test('should not create maskedLocation when no mask matches', () => {
    const router = setup()

    const location = router.buildLocation({
      to: '/photos/$photoId/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeUndefined()
    expect(location.pathname).toBe('/photos/123/modal')
  })

  test('should not create maskedLocation when routeMasks is empty', () => {
    const router = setup([])

    const location = router.buildLocation({
      to: '/photos/$photoId/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeUndefined()
    expect(location.pathname).toBe('/photos/123/modal')
  })

  test('should find and apply mask when pathname matches', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        params: true,
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/photos/123')
    expect(location.pathname).toBe('/photos/123/modal')
  })

  test('should set params to {} when maskParams is false', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/posts',
        params: false,
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/posts')
    // The masked location should have no params since maskParams is false
    expect(location.maskedLocation!.href).toBe('/posts')
  })

  test('should set params to {} when maskParams is null', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/posts',
        params: null,
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/posts')
    expect(location.maskedLocation!.href).toBe('/posts')
  })

  test('should use matched params when maskParams is true', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        params: true,
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/photos/123')
    // The photoId param should be preserved from the matched params
    expect(location.maskedLocation!.href).toBe('/photos/123')
  })

  test('should use matched params when maskParams is undefined', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        // params is undefined, which should default to true behavior
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/photos/123')
    expect(location.maskedLocation!.href).toBe('/photos/123')
  })

  test('should call function when maskParams is a function', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/posts/$postId',
        params: (prev: any) => ({
          postId: prev.photoId,
        }),
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/posts/123')
    // The function should have transformed photoId to postId
    expect(location.maskedLocation!.href).toBe('/posts/123')
  })

  test('should merge object params when maskParams is an object', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        params: {
          photoId: '456', // Override the matched param
        },
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    // The object params should override the matched params
    expect(location.maskedLocation!.pathname).toBe('/photos/456')
    expect(location.maskedLocation!.href).toBe('/photos/456')
  })

  test('should merge object params with matched params', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/posts/$postId/info',
        to: '/posts/$postId',
        params: true, // Use matched params directly
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/posts/123/info',
      params: { postId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/posts/123')
    expect(location.maskedLocation!.href).toBe('/posts/123')
  })

  test('should use first matching mask when multiple masks exist', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        params: true,
      },
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/posts',
        params: false,
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    // Should use the first matching mask
    expect(location.maskedLocation!.pathname).toBe('/photos/123')
  })

  test('should pass through other mask properties (search, hash, state)', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        params: true,
        search: { filter: 'recent' },
        hash: 'section1',
        state: { modal: true },
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/photos/123')
    expect(location.maskedLocation!.search).toEqual({ filter: 'recent' })
    // Hash property stores the value without #, but href includes it
    expect(location.maskedLocation!.hash).toBe('section1')
    expect(location.maskedLocation!.href).toContain('#section1')
    expect(location.maskedLocation!.state).toEqual({ modal: true })
  })

  test('should handle mask with function params that receives matched params', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/posts/$postId/info',
        to: '/posts/$postId',
        params: (prev: any) => {
          // Function receives the matched params from the pathname
          expect(prev.postId).toBe('123')
          return {
            postId: prev.postId,
          }
        },
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/posts/123/info',
      params: { postId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/posts/123')
  })

  test('should not match mask when pathname does not match mask from pattern', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/photos/$photoId',
        params: true,
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/posts/123/info',
      params: { postId: '123' },
    })

    // Should not match the mask since pathname doesn't match
    expect(location.maskedLocation).toBeUndefined()
    expect(location.pathname).toBe('/posts/123/info')
  })

  test('should handle mask with complex param transformation', () => {
    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$photoId/modal',
        to: '/posts/$postId',
        params: (prev: any) => ({
          postId: `photo-${prev.photoId}`,
        }),
      },
    ]

    const router = setup(routeMasks)

    const location = router.buildLocation({
      to: '/photos/123/modal',
      params: { photoId: '123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/posts/photo-123')
  })

  test('should transform params when original and masked routes have different param names', () => {
    const rootRoute = new BaseRootRoute({})
    const photoPrivateRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/photos/$privateId',
    })
    const detailsRoute = new BaseRoute({
      getParentRoute: () => photoPrivateRoute,
      path: '/details',
    })
    const photoPublicRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/photos/$publicId',
    })
    const routeTree = rootRoute.addChildren([
      photoPrivateRoute.addChildren([detailsRoute]),
      photoPublicRoute,
    ])

    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$privateId/details',
        to: '/photos/$publicId',
        params: (prev: any) => ({
          publicId: prev.privateId, // Transform privateId to publicId
        }),
      },
    ]

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
      routeMasks,
    })

    const location = router.buildLocation({
      to: '/photos/abc123/details',
      params: { privateId: 'abc123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/photos/abc123')
    expect(location.pathname).toBe('/photos/abc123/details')
  })

  test('should handle param name transformation with object params', () => {
    const rootRoute = new BaseRootRoute({})
    const photoPrivateRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/photos/$privateId',
    })
    const detailsRoute = new BaseRoute({
      getParentRoute: () => photoPrivateRoute,
      path: '/details',
    })
    const photoPublicRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/photos/$publicId',
    })
    const routeTree = rootRoute.addChildren([
      photoPrivateRoute.addChildren([detailsRoute]),
      photoPublicRoute,
    ])

    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/photos/$privateId/details',
        to: '/photos/$publicId',
        // Use a function to transform params (objects with function values aren't supported)
        params: (prev: any) => ({
          publicId: prev.privateId, // Transform privateId to publicId
        }),
      },
    ]

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
      routeMasks,
    })

    const location = router.buildLocation({
      to: '/photos/secret123/details',
      params: { privateId: 'secret123' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/photos/secret123')
  })

  test('should handle multiple params with different names in masked route', () => {
    const rootRoute = new BaseRootRoute({})
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })
    const postRoute = new BaseRoute({
      getParentRoute: () => userRoute,
      path: '/posts/$postSlug',
    })
    const profileRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/profiles/$profileId',
    })
    const articleRoute = new BaseRoute({
      getParentRoute: () => profileRoute,
      path: '/articles/$articleId',
    })
    const routeTree = rootRoute.addChildren([
      userRoute.addChildren([postRoute]),
      profileRoute.addChildren([articleRoute]),
    ])

    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/users/$userId/posts/$postSlug',
        to: '/profiles/$profileId/articles/$articleId',
        params: (prev: any) => ({
          profileId: prev.userId,
          articleId: prev.postSlug,
        }),
      },
    ]

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
      routeMasks,
    })

    const location = router.buildLocation({
      to: '/users/john/posts/my-first-post',
      params: { userId: 'john', postSlug: 'my-first-post' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe(
      '/profiles/john/articles/my-first-post',
    )
    expect(location.pathname).toBe('/users/john/posts/my-first-post')
  })

  test('should handle param transformation when masked route requires different param', () => {
    const rootRoute = new BaseRootRoute({})
    const adminUsersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/$userId',
    })
    const publicUsersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$username',
    })
    const routeTree = rootRoute.addChildren([adminUsersRoute, publicUsersRoute])

    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/admin/users/$userId',
        to: '/users/$username',
        params: (prev: any) => {
          // Simulate looking up username from userId
          return {
            username: `user-${prev.userId}`, // Transform userId to username format
          }
        },
      },
    ]

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
      routeMasks,
    })

    const location = router.buildLocation({
      to: '/admin/users/42',
      params: { userId: '42' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe('/users/user-42')
    expect(location.pathname).toBe('/admin/users/42')
  })

  test('should handle partial param transformation when some params are kept', () => {
    const rootRoute = new BaseRootRoute({})
    const postRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/$postId',
    })
    const commentRoute = new BaseRoute({
      getParentRoute: () => postRoute,
      path: '/comments/$commentId',
    })
    const articleRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/articles/$articleId',
    })
    const replyRoute = new BaseRoute({
      getParentRoute: () => articleRoute,
      path: '/replies/$replyId',
    })
    const routeTree = rootRoute.addChildren([
      postRoute.addChildren([commentRoute]),
      articleRoute.addChildren([replyRoute]),
    ])

    const routeMasks: Array<RouteMask<any>> = [
      {
        routeTree: null as any,
        from: '/posts/$postId/comments/$commentId',
        to: '/articles/$articleId/replies/$replyId',
        params: (prev: any) => ({
          articleId: `article-${prev.postId}`,
          replyId: prev.commentId, // Keep commentId as replyId
        }),
      },
    ]

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
      routeMasks,
    })

    const location = router.buildLocation({
      to: '/posts/5/comments/10',
      params: { postId: '5', commentId: '10' },
    })

    expect(location.maskedLocation).toBeDefined()
    expect(location.maskedLocation!.pathname).toBe(
      '/articles/article-5/replies/10',
    )
  })
})
