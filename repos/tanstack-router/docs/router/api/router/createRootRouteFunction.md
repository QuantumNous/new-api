---
id: createRootRouteFunction
title: createRootRoute function
---

The `createRootRoute` function returns a new root route instance. A root route instance can then be used to create a route-tree.

## createRootRoute options

The options that will be used to configure the root route instance.

- Type:

```tsx
Omit<
  RouteOptions,
  | 'path'
  | 'id'
  | 'getParentRoute'
  | 'caseSensitive'
  | 'parseParams'
  | 'stringifyParams'
>
```

- [`RouteOptions`](./RouteOptionsType.md)
- Optional

## createRootRoute returns

A new [`Route`](./RouteType.md) instance.

## Examples

```tsx
import { createRootRoute, createRouter, Outlet } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  // ... root route options
})

const routeTree = rootRoute.addChildren([
  // ... other routes
])

const router = createRouter({
  routeTree,
})
```
