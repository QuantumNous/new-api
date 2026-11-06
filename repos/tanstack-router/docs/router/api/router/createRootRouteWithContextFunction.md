---
id: createRootRouteWithContextFunction
title: createRootRouteWithContext function
---

The `createRootRouteWithContext` function is a helper function that can be used to create a root route instance that requires a context type to be fulfilled when the router is created.

## createRootRouteWithContext generics

The `createRootRouteWithContext` function accepts a single generic argument:

### `TRouterContext` generic

- Type: `TRouterContext`
- Optional, **but recommended**.
- The context type that will be required to be fulfilled when the router is created

## createRootRouteWithContext returns

- A factory function that can be used to create a new [`createRootRoute`](./createRootRouteFunction.md) instance.
- It accepts a single argument, the same as the [`createRootRoute`](./createRootRouteFunction.md) function.

## Examples

```tsx
import {
  createRootRouteWithContext,
  createRouter,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<MyRouterContext>()({
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
