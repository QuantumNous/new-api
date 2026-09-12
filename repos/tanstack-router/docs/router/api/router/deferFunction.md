---
id: deferFunction
title: defer function
---

> [!CAUTION]
> You don't need to call `defer` manually anymore, Promises are handled automatically now.

The `defer` function wraps a promise with a deferred state object that can be used to inspect the promise's state. This deferred promise can then be passed to the [`useAwaited`](./useAwaitedHook.md) hook or the [`<Await>`](./awaitComponent.md) component for suspending until the promise is resolved or rejected.

The `defer` function accepts a single argument, the `promise` to wrap with a deferred state object.

## defer options

- Type: `Promise<T>`
- Required
- The promise to wrap with a deferred state object.

## defer returns

- A promise that can be passed to the [`useAwaited`](./useAwaitedHook.md) hook or the [`<Await>`](./awaitComponent.md) component.

## Examples

```tsx
import { defer } from '@tanstack/react-router'

const route = createRoute({
  loader: () => {
    const deferredPromise = defer(fetch('/api/data'))
    return { deferredPromise }
  },
  component: MyComponent,
})

function MyComponent() {
  const { deferredPromise } = Route.useLoaderData()

  const data = useAwaited({ promise: deferredPromise })

  // or

  return (
    <Await promise={deferredPromise}>
      {(data) => <div>{JSON.stringify(data)}</div>}
    </Await>
  )
}
```
