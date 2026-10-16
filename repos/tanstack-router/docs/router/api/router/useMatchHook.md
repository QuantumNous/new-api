---
id: useMatchHook
title: useMatch hook
---

The `useMatch` hook returns a [`RouteMatch`](./RouteMatchType.md) in the component tree. The raw route match contains all of the information about a route match in the router and also powers many other hooks under the hood like `useParams`, `useLoaderData`, `useRouteContext`, and `useSearch`.

## useMatch options

The `useMatch` hook accepts a single argument, an `options` object.

### `opts.from` option

- Type: `string`
- The route id of a match
- Optional, but recommended for full type safety.
- If `opts.strict` is `true`, `from` is required and TypeScript will warn for this option if it is not provided.
- If `opts.strict` is `false`, `from` must not be set and TypeScript will provided loosened types for the returned [`RouteMatch`](./RouteMatchType.md).

### `opts.strict` option

- Type: `boolean`
- Optional
- `default: true`
- If `false`, the `opts.from` must not be set and types will be loosened to `Partial<RouteMatch>` to reflect the shared types of all matches.

### `opts.select` option

- Optional
- `(match: RouteMatch) => TSelected`
- If supplied, this function will be called with the route match and the return value will be returned from `useMatch`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.

### `opts.structuralSharing` option

- Type: `boolean`
- Optional
- Configures whether structural sharing is enabled for the value returned by `select`.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

### `opts.shouldThrow` option

- Type: `boolean`
- Optional
- `default: true`
- If `false`,`useMatch` will not throw an invariant exception in case a match was not found in the currently rendered matches; in this case, it will return `undefined`.

## useMatch returns

- If a `select` function is provided, the return value of the `select` function.
- If no `select` function is provided, the [`RouteMatch`](./RouteMatchType.md) object or a loosened version of the `RouteMatch` object if `opts.strict` is `false`.

## Examples

### Accessing a route match

```tsx
import { useMatch } from '@tanstack/react-router'

function Component() {
  const match = useMatch({ from: '/posts/$postId' })
  //     ^? strict match for RouteMatch
  // ...
}
```

### Accessing the root route's match

```tsx
import {
  useMatch,
  rootRouteId, // <<<< use this token!
} from '@tanstack/react-router'

function Component() {
  const match = useMatch({ from: rootRouteId })
  //     ^? strict match for RouteMatch
  // ...
}
```

### Checking if a specific route is currently rendered

```tsx
import { useMatch } from '@tanstack/react-router'

function Component() {
  const match = useMatch({ from: '/posts', shouldThrow: false })
  //     ^? RouteMatch | undefined
  if (match !== undefined) {
    // ...
  }
}
```
