---
id: getRouteApiFunction
title: getRouteApi function
---

The `getRouteApi` function provides type-safe version of common hooks like `useParams`, `useSearch`, `useRouteContext`, `useNavigate`, `useLoaderData`, and `useLoaderDeps` that are pre-bound to a specific route ID and corresponding registered route types.

## getRouteApi options

The `getRouteApi` function accepts a single argument, a `routeId` string literal.

### `routeId` option

- Type: `string`
- Required
- The route ID to which the [`RouteApi`](./RouteApiClass.md) instance will be bound

## getRouteApi returns

- An instance of the [`RouteApi`](./RouteApiType.md) that is pre-bound to the route ID that the `getRouteApi` function was called with.

## Examples

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts')

export function PostsPage() {
  const posts = routeApi.useLoaderData()
  // ...
}
```
