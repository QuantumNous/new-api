---
id: awaitComponent
title: Await component
---

The `Await` component is a component that suspends until the provided promise is resolved or rejected.
This is only necessary for React 18.
If you are using React 19, you can use the `use()` hook instead.

## Await props

The `Await` component accepts the following props:

### `props.promise` prop

- Type: `Promise<T>`
- Required
- The promise to await.

### `props.children` prop

- Type: `(result: T) => React.ReactNode`
- Required
- A function that will be called with the resolved value of the promise.

## Await returns

- Throws an error if the promise is rejected.
- Suspends (throws a promise) if the promise is pending.
- Returns the resolved value of a deferred promise if the promise is resolved using `props.children` as the render function.

## Examples

```tsx
import { Await } from '@tanstack/react-router'

function Component() {
  const { deferredPromise } = route.useLoaderData()

  return (
    <Await promise={deferredPromise}>
      {(data) => <div>{JSON.stringify(data)}</div>}
    </Await>
  )
}
```
