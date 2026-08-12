---
id: RouteApiClass
title: RouteApi class
---

> [!CAUTION]
> This class has been deprecated and will be removed in the next major version of TanStack Router.
> Please use the [`getRouteApi`](./getRouteApiFunction.md) function instead.

The `RouteApi` class provides type-safe version of common hooks like `useParams`, `useSearch`, `useRouteContext`, `useNavigate`, `useLoaderData`, and `useLoaderDeps` that are pre-bound to a specific route ID and corresponding registered route types.

## Constructor options

The `RouteApi` constructor accepts a single argument: the `options` that will be used to configure the `RouteApi` instance.

### `opts.routeId` option

- Type: `string`
- Required
- The route ID to which the `RouteApi` instance will be bound

## Constructor returns

- An instance of the [`RouteApi`](./RouteApiType.md) that is pre-bound to the route ID that it was called with.

## Examples

```tsx
import { RouteApi } from '@tanstack/react-router'

const routeApi = new RouteApi({ id: '/posts' })

export function PostsPage() {
  const posts = routeApi.useLoaderData()
  // ...
}
```
