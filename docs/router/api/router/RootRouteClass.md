---
id: RootRouteClass
title: RootRoute class
---

> [!CAUTION]
> This class has been deprecated and will be removed in the next major version of TanStack Router.
> Please use the [`createRootRoute`](./createRootRouteFunction.md) function instead.

The `RootRoute` class extends the `Route` class and can be used to create a root route instance. A root route instance can then be used to create a route tree.

## `RootRoute` constructor

The `RootRoute` constructor accepts an object as its only argument.

### Constructor options

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

## Constructor returns

A new [`Route`](./RouteType.md) instance.

## Examples

```tsx
import { RootRoute, createRouter, Outlet } from '@tanstack/react-router'

const rootRoute = new RootRoute({
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
