---
id: RouteClass
title: Route class
---

> [!CAUTION]
> This class has been deprecated and will be removed in the next major version of TanStack Router.
> Please use the [`createRoute`](./createRouteFunction.md) function instead.

The `Route` class implements the `RouteApi` class and can be used to create route instances. A route instance can then be used to create a route tree.

## `Route` constructor

The `Route` constructor accepts an object as its only argument.

### Constructor options

- Type: [`RouteOptions`](./RouteOptionsType.md)
- Required
- The options that will be used to configure the route instance

### Constructor returns

A new [`Route`](./RouteType.md) instance.

## Examples

```tsx
import { Route } from '@tanstack/react-router'
import { rootRoute } from './__root'

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: () => {
    return 'Hello World'
  },
  component: IndexComponent,
})

function IndexComponent() {
  const data = indexRoute.useLoaderData()
  return <div>{data}</div>
}
```
