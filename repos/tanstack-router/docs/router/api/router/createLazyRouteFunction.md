---
id: createLazyRouteFunction
title: createLazyRoute function
---

The `createLazyRoute` function is used for creating a partial code-based route instance that is lazily loaded when matched. This route instance can only be used to configure the [non-critical properties](../../guide/code-splitting.md#how-does-tanstack-router-split-code) of the route, such as `component`, `pendingComponent`, `errorComponent`, and the `notFoundComponent`.

## createLazyRoute options

The `createLazyRoute` function accepts a single argument of type `string` that represents the `id` of the route.

### `id`

- Type: `string`
- Required
- The route id of the route.

### createLazyRoute returns

A new function that accepts a single argument of partial of the type [`RouteOptions`](./RouteOptionsType.md) that will be used to configure the file [`Route`](./RouteType.md) instance.

- Type:

```tsx
Pick<
  RouteOptions,
  'component' | 'pendingComponent' | 'errorComponent' | 'notFoundComponent'
>
```

- [`RouteOptions`](./RouteOptionsType.md)

> ⚠️ Note: This route instance must be manually lazily loaded against its critical route instance using the `lazy` method returned by the `createRoute` function.

### Examples

```tsx
// src/route-pages/index.tsx
import { createLazyRoute } from '@tanstack/react-router'

export const Route = createLazyRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  const data = Route.useLoaderData()
  return <div>{data}</div>
}

// src/routeTree.tsx
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
} from '@tanstack/react-router'

interface MyRouterContext {
  foo: string
}

const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
}).lazy(() => import('./route-pages/index').then((d) => d.Route))

export const routeTree = rootRoute.addChildren([indexRoute])
```
