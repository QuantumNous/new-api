---
id: NotFoundRouteClass
title: NotFoundRoute class
---

> [!CAUTION]
> This class has been deprecated and will be removed in the next major version of TanStack Router.
> Please use the `notFoundComponent` route option that is present during route configuration.
> See the [Not Found Errors guide](../../guide/not-found-errors.md) for more information.

The `NotFoundRoute` class extends the `Route` class and can be used to create a not found route instance. A not found route instance can be passed to the `routerOptions.notFoundRoute` option to configure a default not-found/404 route for every branch of the route tree.

## Constructor options

The `NotFoundRoute` constructor accepts an object as its only argument.

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

- [RouteOptions](./RouteOptionsType.md)
- Required
- The options that will be used to configure the not found route instance.

## Examples

```tsx
import { NotFoundRoute, createRouter } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { routeTree } from './routeTree.gen'

const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: () => <div>Not found!!!</div>,
})

const router = createRouter({
  routeTree,
  notFoundRoute,
})

// ... other code
```
