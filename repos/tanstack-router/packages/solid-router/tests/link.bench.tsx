import { render } from '@solidjs/testing-library'
import { bench, describe } from 'vitest'
import {
  Link,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  interpolatePath,
  useRouter,
} from '../src'
import type { LinkProps } from '../src'
import type * as Solid from 'solid-js'

const createRouterRenderer =
  (routesCount: number) => (children: Solid.JSX.Element) => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => children,
    })
    const paramRoutes = Array.from({ length: routesCount }).map((_, i) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path: `/params/$param${i}`,
      }),
    )
    const routeTree = rootRoute.addChildren([indexRoute, ...paramRoutes])
    return createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
  }

const InterpolatePathLink = ({
  to,
  params,
  children,
}: Solid.PropsWithChildren<LinkProps>) => {
  const href = interpolatePath({ path: to, params }).interpolatedPath
  return <a href={href}>{children}</a>
}

const BuildLocationLink = ({
  children,
  ...props
}: Solid.PropsWithChildren<LinkProps>) => {
  const router = useRouter()
  const { href } = router.buildLocation(props)
  return <a href={href}>{children}</a>
}

describe.each([
  {
    name: 'small router',
    numberOfRoutes: 1,
    matchedParamId: 0, // range from 0 to numberOfRoutes-1
    numberOfLinks: 5000,
  },
  {
    name: 'medium router',
    numberOfRoutes: 1000,
    matchedParamId: 500, // range from 0 to numberOfRoutes-1
    numberOfLinks: 5000,
  },
  // {
  //   name: 'large router',
  //   numberOfRoutes: 10000,
  //   matchedParamId: 9999, // range from 0 to numberOfRoutes-1
  //   numberOfLinks: 15000,
  // },
])('$name', ({ numberOfRoutes, numberOfLinks, matchedParamId }) => {
  const renderRouter = createRouterRenderer(numberOfRoutes)

  bench(
    'hardcoded href',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => (
          <a href={`/params/${i}`}>{i}</a>
        )),
      )
      render(() => <RouterProvider router={router} />)
    },
    { warmupIterations: 1 },
  )

  bench(
    'interpolate path',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => (
          <InterpolatePathLink
            to={`/params/$param${Math.min(i, matchedParamId)}`}
            params={{ [`param${Math.min(i, matchedParamId)}`]: i }}
          >
            {i}
          </InterpolatePathLink>
        )),
      )
      render(() => <RouterProvider router={router} />)
    },
    { warmupIterations: 1 },
  )

  bench(
    'build location',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => (
          <BuildLocationLink
            to={`/params/$param${Math.min(i, matchedParamId)}`}
            params={{ [`param${Math.min(i, matchedParamId)}`]: i }}
          >
            {i}
          </BuildLocationLink>
        )),
      )
      render(() => <RouterProvider router={router} />)
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to absolute path',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => (
          <Link
            to={`/params/$param${Math.min(i, matchedParamId)}`}
            params={{ [`param${Math.min(i, matchedParamId)}`]: i }}
          >
            {i}
          </Link>
        )),
      )
      render(() => <RouterProvider router={router} />)
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to relative path',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => {
          const to = `./params/$param${Math.min(i, matchedParamId)}`

          return (
            <Link
              from="/"
              to={to}
              params={{ [`param${Math.min(i, matchedParamId)}`]: i }}
            >
              {i}
            </Link>
          )
        }),
      )
      render(() => <RouterProvider router={router} />)
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to current path',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => (
          <Link from="/" search={{ param: i }}>
            {i}
          </Link>
        )),
      )
      render(() => <RouterProvider router={router} />)
    },
    { warmupIterations: 1 },
  )
})
