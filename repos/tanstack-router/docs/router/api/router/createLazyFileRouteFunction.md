---
id: createLazyFileRouteFunction
title: createLazyFileRoute function
---

The `createLazyFileRoute` function is used for creating a partial file-based route instance that is lazily loaded when matched. This route instance can only be used to configure the [non-critical properties](../../guide/code-splitting.md#how-does-tanstack-router-split-code) of the route, such as `component`, `pendingComponent`, `errorComponent`, and the `notFoundComponent`.

## createLazyFileRoute options

The `createLazyFileRoute` function accepts a single argument of type `string` that represents the `path` of the file that the route will be generated from.

### `path`

- Type: `string`
- Required, but **automatically inserted and updated by the `tsr generate` and `tsr watch` commands**
- The full path of the file that the route will be generated from.

### createLazyFileRoute returns

A new function that accepts a single argument of partial of the type [`RouteOptions`](./RouteOptionsType.md) that will be used to configure the file [`Route`](./RouteType.md) instance.

- Type:

```tsx
Pick<
  RouteOptions,
  'component' | 'pendingComponent' | 'errorComponent' | 'notFoundComponent'
>
```

- [`RouteOptions`](./RouteOptionsType.md)

> ⚠️ Note: For `tsr generate` and `tsr watch` to work properly, the file route instance must be exported from the file using the `Route` identifier.

### Examples

```tsx
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  const data = Route.useLoaderData()
  return <div>{data}</div>
}
```
