---
id: useLoaderDataHook
title: useLoaderData hook
---

The `useLoaderData` hook returns the loader data from the closest [`RouteMatch`](./RouteMatchType.md) in the component tree.

## useLoaderData options

The `useLoaderData` hook accepts an `options` object.

### `opts.from` option

- Type: `string`
- The route id of the closest parent match
- Optional, but recommended for full type safety.
- If `opts.strict` is `true`, TypeScript will warn for this option if it is not provided.
- If `opts.strict` is `false`, TypeScript will provide loosened types for the returned loader data.

### `opts.strict` option

- Type: `boolean`
- Optional - `default: true`
- If `false`, the `opts.from` option will be ignored and types will be loosened to reflect the shared types of all possible loader data.

### `opts.select` option

- Optional
- `(loaderData: TLoaderData) => TSelected`
- If supplied, this function will be called with the loader data and the return value will be returned from `useLoaderData`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.

### `opts.structuralSharing` option

- Type: `boolean`
- Optional
- Configures whether structural sharing is enabled for the value returned by `select`.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

## useLoaderData returns

- If a `select` function is provided, the return value of the `select` function.
- If no `select` function is provided, the loader data or a loosened version of the loader data if `opts.strict` is `false`.

## Examples

```tsx
import { useLoaderData } from '@tanstack/react-router'

function Component() {
  const loaderData = useLoaderData({ from: '/posts/$postId' })
  //     ^? { postId: string, body: string, ... }
  // ...
}
```
