---
id: useRouteContextHook
title: useRouteContext hook
---

The `useRouteContext` method is a hook that returns the current context for the current route. This hook is useful for accessing the current route context in a component.

## useRouteContext options

The `useRouteContext` hook accepts an `options` object.

### `opts.from` option

- Type: `string`
- Required
- The RouteID to match the route context from.

### `opts.select` option

- Type: `(context: RouteContext) => TSelected`
- Optional
- If supplied, this function will be called with the route context object and the return value will be returned from `useRouteContext`.

## useRouteContext returns

- The current context for the current route or `TSelected` if a `select` function is provided.

## Examples

```tsx
import { useRouteContext } from '@tanstack/react-router'

function Component() {
  const context = useRouteContext({ from: '/posts/$postId' })
  //    ^ RouteContext

  // OR

  const selected = useRouteContext({
    from: '/posts/$postId',
    select: (context) => context.postId,
  })
  //    ^ string

  // ...
}
```
