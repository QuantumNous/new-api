---
id: rootRouteWithContextFunction
title: rootRouteWithContext function
---

> [!CAUTION]
> This function is deprecated and will be removed in the next major version of TanStack Router.
> Please use the [`createRootRouteWithContext`](./createRootRouteWithContextFunction.md) function instead.

The `rootRouteWithContext` function is a helper function that can be used to create a root route instance that requires a context type to be fulfilled when the router is created.

## rootRouteWithContext generics

The `rootRouteWithContext` function accepts a single generic argument:

### `TRouterContext` generic

- Type: `TRouterContext`
- Optional, **but recommended**.
- The context type that will be required to be fulfilled when the router is created

## rootRouteWithContext returns

- A factory function that can be used to create a new [`createRootRoute`](./createRootRouteFunction.md) instance.
- It accepts a single argument, the same as the [`createRootRoute`](./createRootRouteFunction.md) function.

## Examples

```tsx
import { rootRouteWithContext, createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const rootRoute = rootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
  // ... root route options
})

const routeTree = rootRoute.addChildren([
  // ... other routes
])

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
})
```
