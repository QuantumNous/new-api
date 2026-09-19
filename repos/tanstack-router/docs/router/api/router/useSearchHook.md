---
id: useSearchHook
title: useSearch hook
---

The `useSearch` method is a hook that returns the current search query parameters as an object for the current location. This hook is useful for accessing the current search string and query parameters in a component.

## useSearch options

The `useSearch` hook accepts an `options` object.

### `opts.from` option

- Type: `string`
- Required
- The RouteID to match the search query parameters from.

### `opts.shouldThrow` option

- Type: `boolean`
- Optional
- `default: true`
- If `false`,`useSearch` will not throw an invariant exception in case a match was not found in the currently rendered matches; in this case, it will return `undefined`.

### `opts.select` option

- Type: `(search: SelectedSearchSchema) => TSelected`
- Optional
- If supplied, this function will be called with the search object and the return value will be returned from `useSearch`.

### `opts.structuralSharing` option

- Type: `boolean`
- Optional
- Configures whether structural sharing is enabled for the value returned by `select`.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

### `opts.strict` option

- Type: `boolean`
- Optional - `default: true`
- If `false`, the `opts.from` option will be ignored and types will be loosened to `Partial<FullSearchSchema>` to reflect the shared types of all search query parameters.

## useSearch returns

- If `opts.from` is provided, an object of the search query parameters for the current location or `TSelected` if a `select` function is provided.
- If `opts.strict` is `false`, an object of the search query parameters for the current location or `TSelected` if a `select` function is provided.

## Examples

```tsx
import { useSearch } from '@tanstack/react-router'

function Component() {
  const search = useSearch({ from: '/posts/$postId' })
  //    ^ FullSearchSchema

  // OR

  const selected = useSearch({
    from: '/posts/$postId',
    select: (search) => search.postView,
  })
  //    ^ string

  // OR

  const looseSearch = useSearch({ strict: false })
  //    ^ Partial<FullSearchSchema>

  // ...
}
```
