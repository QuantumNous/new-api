/** @jsxImportSource vue */

import { render } from '@testing-library/vue'
import { bench, describe } from 'vitest'
import * as Vue from 'vue'
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

const createRouterRenderer = (routesCount: number) => (children: Vue.VNode) => {
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

const InterpolatePathLink = Vue.defineComponent({
  props: ['to', 'params'],
  setup(props, { slots }) {
    const href = interpolatePath({
      path: props.to,
      params: props.params,
    }).interpolatedPath

    return () => Vue.h('a', { href }, slots.default?.())
  },
})

const BuildLocationLink = Vue.defineComponent({
  props: ['to', 'params', 'from', 'search', 'hash', 'state'],
  setup(props, { slots }) {
    const router = useRouter()
    const location = Vue.computed(() => {
      return router.buildLocation(props)
    })

    return () => Vue.h('a', { href: location.value.href }, slots.default?.())
  },
})

describe.each([
  {
    name: 'small router',
    numberOfRoutes: 1,
    matchedParamId: 0, // range from 0 to numberOfRoutes-1
    numberOfLinks: 500, // Reduced for faster tests
  },
  {
    name: 'medium router',
    numberOfRoutes: 100, // Reduced for faster tests
    matchedParamId: 50, // range from 0 to numberOfRoutes-1
    numberOfLinks: 500, // Reduced for faster tests
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
      const links = Vue.h(
        'div',
        null,
        Array.from({ length: numberOfLinks }).map((_, i) =>
          Vue.h('a', { key: i, href: `/params/${i}` }, `${i}`),
        ),
      )

      const router = renderRouter(links)
      render(Vue.h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'interpolate path',
    () => {
      const links = Vue.h(
        'div',
        null,
        Array.from({ length: numberOfLinks }).map((_, i) =>
          Vue.h(
            InterpolatePathLink,
            {
              key: i,
              to: `/params/$param${Math.min(i, matchedParamId)}`,
              params: { [`param${Math.min(i, matchedParamId)}`]: i },
            },
            () => `${i}`,
          ),
        ),
      )

      const router = renderRouter(links)
      render(Vue.h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'build location',
    () => {
      const links = Vue.h(
        'div',
        null,
        Array.from({ length: numberOfLinks }).map((_, i) =>
          Vue.h(
            BuildLocationLink,
            {
              key: i,
              to: `/params/$param${Math.min(i, matchedParamId)}`,
              params: { [`param${Math.min(i, matchedParamId)}`]: i },
            },
            () => `${i}`,
          ),
        ),
      )

      const router = renderRouter(links)
      render(Vue.h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to absolute path',
    () => {
      const links = Vue.h(
        'div',
        null,
        Array.from({ length: numberOfLinks }).map((_, i) => {
          const params = { [`param${Math.min(i, matchedParamId)}`]: i } as any

          return Vue.h(
            Link,
            {
              key: i,
              to: `/params/$param${Math.min(i, matchedParamId)}`,
              params,
            },
            () => `${i}`,
          )
        }),
      )

      const router = renderRouter(links)
      render(Vue.h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to relative path',
    () => {
      const links = Vue.h(
        'div',
        null,
        Array.from({ length: numberOfLinks }).map((_, i) => {
          const to = `./params/$param${Math.min(i, matchedParamId)}`
          const params = { [`param${Math.min(i, matchedParamId)}`]: i } as any

          return Vue.h(
            Link,
            {
              key: i,
              from: '/',
              to,
              params,
            },
            () => `${i}`,
          )
        }),
      )

      const router = renderRouter(links)
      render(Vue.h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to current path',
    () => {
      const links = Vue.h(
        'div',
        null,
        Array.from({ length: numberOfLinks }).map((_, i) => {
          const search = { param: i } as any

          return Vue.h(
            Link,
            {
              key: i,
              from: '/',
              search,
            },
            () => `${i}`,
          )
        }),
      )

      const router = renderRouter(links)
      render(Vue.h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )
})
