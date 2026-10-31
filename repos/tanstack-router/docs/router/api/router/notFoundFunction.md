---
id: notFoundFunction
title: notFound function
---

The `notFound` function returns a new `NotFoundError` object that can be either returned or thrown from places like a Route's `beforeLoad` or `loader` callbacks to trigger the `notFoundComponent`.

## notFound options

The `notFound` function accepts a single optional argument, the `options` to create the not-found error object.

- Type: [`Partial<NotFoundError>`](./NotFoundErrorType.md)
- Optional

## notFound returns

- If the `throw` property is `true` in the `options` object, the `NotFoundError` object will be thrown from within the function call.
- If the `throw` property is `false | undefined` in the `options` object, the `NotFoundError` object will be returned.

## Examples

```tsx
import { notFound, createFileRoute, rootRouteId } from '@tanstack/react-router'

const Route = new createFileRoute('/posts/$postId')({
  // throwing a not-found object
  loader: ({ context: { post } }) => {
    if (!post) {
      throw notFound()
    }
  },
  // or if you want to show a not-found on the whole page
  loader: ({ context: { team } }) => {
    if (!team) {
      throw notFound({ routeId: rootRouteId })
    }
  },
  // ... other route options
})
```
