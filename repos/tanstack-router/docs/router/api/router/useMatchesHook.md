---
id: useMatchesHook
title: useMatches hook
---

The `useMatches` hook returns all of the [`RouteMatch`](./RouteMatchType.md) objects from the router **regardless of its callers position in the React component tree**.

> [!TIP]
> If you only want the parent or child matches, then you can use the [`useParentMatches`](./useParentMatchesHook.md) or the [`useChildMatches`](./useChildMatchesHook.md) based on the selection you need.

## useMatches options

The `useMatches` hook accepts a single _optional_ argument, an `options` object.

### `opts.select` option

- Optional
- `(matches: RouteMatch[]) => TSelected`
- If supplied, this function will be called with the route matches and the return value will be returned from `useMatches`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.

### `opts.structuralSharing` option

- Type: `boolean`
- Optional
- Configures whether structural sharing is enabled for the value returned by `select`.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

## useMatches returns

- If a `select` function is provided, the return value of the `select` function.
- If no `select` function is provided, an array of [`RouteMatch`](./RouteMatchType.md) objects.

## Examples

```tsx
import { useMatches } from '@tanstack/react-router'

function Component() {
  const matches = useMatches()
  //     ^? [RouteMatch, RouteMatch, ...]
  // ...
}
```
