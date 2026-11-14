---
id: FileRouteClass
title: FileRoute class
---

> [!CAUTION]
> This class has been deprecated and will be removed in the next major version of TanStack Router.
> Please use the [`createFileRoute`](./createFileRouteFunction.md) function instead.

The `FileRoute` class is a factory that can be used to create a file-based route instance. This route instance can then be used to automatically generate a route tree with the `tsr generate` and `tsr watch` commands.

## `FileRoute` constructor

The `FileRoute` constructor accepts a single argument: the `path` of the file that the route will be generated for.

### Constructor options

- Type: `string` literal
- Required, but **automatically inserted and updated by the `tsr generate` and `tsr watch` commands**.
- The full path of the file that the route will be generated from.

### Constructor returns

- An instance of the `FileRoute` class that can be used to create a route.

## `FileRoute` methods

The `FileRoute` class implements the following method(s):

### `.createRoute` method

The `createRoute` method is a method that can be used to configure the file route instance. It accepts a single argument: the `options` that will be used to configure the file route instance.

#### .createRoute options

- Type: `Omit<RouteOptions, 'getParentRoute' | 'path' | 'id'>`
- [`RouteOptions`](./RouteOptionsType.md)
- Optional
- The same options that are available to the `Route` class, but with the `getParentRoute`, `path`, and `id` options omitted since they are unnecessary for file-based routing.

#### .createRoute returns

A [`Route`](./RouteType.md) instance that can be used to configure the route to be inserted into the route-tree.

> ⚠️ Note: For `tsr generate` and `tsr watch` to work properly, the file route instance must be exported from the file using the `Route` identifier.

### Examples

```tsx
import { FileRoute } from '@tanstack/react-router'

export const Route = new FileRoute('/').createRoute({
  loader: () => {
    return 'Hello World'
  },
  component: IndexComponent,
})

function IndexComponent() {
  const data = Route.useLoaderData()
  return <div>{data}</div>
}
```
