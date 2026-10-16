---
id: useParamsHook
title: useParams hook
---

The `useParams` method returns all of the path parameters that were parsed for the closest match and all of its parent matches.

## useParams options

The `useParams` hook accepts an optional `options` object.

### `opts.strict` option

- Type: `boolean`
- Optional - `default: true`
- If `false`, the `opts.from` option will be ignored and types will be loosened to `Partial<AllParams>` to reflect the shared types of all params.

### `opts.shouldThrow` option

- Type: `boolean`
- Optional
- `default: true`
- If `false`,`useParams` will not throw an invariant exception in case a match was not found in the currently rendered matches; in this case, it will return `undefined`.

### `opts.select` option

- Optional
- `(params: AllParams) => TSelected`
- If supplied, this function will be called with the params object and the return value will be returned from `useParams`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.

### `opts.structuralSharing` option

- Type: `boolean`
- Optional
- Configures whether structural sharing is enabled for the value returned by `select`.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

## useParams returns

- An object of the match's and parent match path params or `TSelected` if a `select` function is provided.

## Examples

```tsx
import { useParams } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts/$postId')

function Component() {
  const params = useParams({ from: '/posts/$postId' })

  // OR

  const routeParams = routeApi.useParams()

  // OR

  const postId = useParams({
    from: '/posts/$postId',
    select: (params) => params.postId,
  })

  // OR

  const looseParams = useParams({ strict: false })

  // ...
}
```
