---
id: useLoaderDepsHook
title: useLoaderDeps hook
---

The `useLoaderDeps` hook is a hook that returns an object with the dependencies that are used to trigger the `loader` for a given route.

## useLoaderDepsHook options

The `useLoaderDepsHook` hook accepts an `options` object.

### `opts.from` option

- Type: `string`
- Required
- The RouteID or path to get the loader dependencies from.

### `opts.select` option

- Type: `(deps: TLoaderDeps) => TSelected`
- Optional
- If supplied, this function will be called with the loader dependencies object and the return value will be returned from `useLoaderDeps`.

### `opts.structuralSharing` option

- Type: `boolean`
- Optional
- Configures whether structural sharing is enabled for the value returned by `select`.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

## useLoaderDeps returns

- An object of the loader dependencies or `TSelected` if a `select` function is provided.

## Examples

```tsx
import { useLoaderDeps } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts/$postId')

function Component() {
  const deps = useLoaderDeps({ from: '/posts/$postId' })

  // OR

  const routeDeps = routeApi.useLoaderDeps()

  // OR

  const postId = useLoaderDeps({
    from: '/posts',
    select: (deps) => deps.view,
  })

  // ...
}
```
