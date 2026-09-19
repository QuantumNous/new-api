---
id: useBlockerHook
title: useBlocker hook
---

The `useBlocker` method is a hook that [blocks navigation](../../guide/navigation-blocking.md) when a condition is met.

> ⚠️ The following new `useBlocker` API is currently _experimental_.

## useBlocker options

The `useBlocker` hook accepts a single _required_ argument, an option object:

### `options.shouldBlockFn` option

- Required
- Type: `ShouldBlockFn`
- This function should return a `boolean` or a `Promise<boolean>` that tells the blocker if it should block the current navigation
- The function has the argument of type `ShouldBlockFnArgs` passed to it, which tells you information about the current and next route and the action performed
- Think of this function as telling the router if it should block the navigation, so returning `true` mean that it should block the navigation and `false` meaning that it should be allowed

```ts
type ShouldBlockFnLocation<...> = {
  routeId: TRouteId
  fullPath: TFullPath
  pathname: string
  params: TAllParams
  search: TFullSearchSchema
}

type ShouldBlockFnArgs = {
  current: ShouldBlockFnLocation
  next: ShouldBlockFnLocation
  action: HistoryAction
}
```

### `options.disabled` option

- Optional - defaults to `false`
- Type: `boolean`
- Specifies if the blocker should be entirely disabled or not

### `options.enableBeforeUnload` option

- Optional - defaults to `true`
- Type: `boolean | (() => boolean)`
- Tell the blocker to sometimes or always block the browser `beforeUnload` event or not

### `options.withResolver` option

- Optional - defaults to `false`
- Type: `boolean`
- Specify if the resolver returned by the hook should be used or whether your `shouldBlockFn` function itself resolves the blocking

### `options.blockerFn` option (⚠️ deprecated)

- Optional
- Type: `BlockerFn`
- The function that returns a `boolean` or `Promise<boolean>` indicating whether to allow navigation.

### `options.condition` option (⚠️ deprecated)

- Optional - defaults to `true`
- Type: `boolean`
- A navigation attempt is blocked when this condition is `true`.

## useBlocker returns

An object with the controls to allow manual blocking and unblocking of navigation.

- `status` - A string literal that can be either `'blocked'` or `'idle'`
- `next` - When status is `blocked`, a type narrrowable object that contains information about the next location
- `current` - When status is `blocked`, a type narrrowable object that contains information about the current location
- `action` - When status is `blocked`, a `HistoryAction` string that shows the action that triggered the navigation
- `proceed` - When status is `blocked`, a function that allows navigation to continue
- `reset` - When status is `blocked`, a function that cancels navigation (`status` will be reset to `'idle'`)

or

`void` when `withResolver` is `false`

## Examples

Two common use cases for the `useBlocker` hook are:

### Basic usage

```tsx
import { useBlocker } from '@tanstack/react-router'

function MyComponent() {
  const [formIsDirty, setFormIsDirty] = useState(false)

  useBlocker({
    shouldBlockFn: () => formIsDirty,
  })

  // ...
}
```

### Custom UI

```tsx
import { useBlocker } from '@tanstack/react-router'

function MyComponent() {
  const [formIsDirty, setFormIsDirty] = useState(false)

  const { proceed, reset, status, next } = useBlocker({
    shouldBlockFn: () => formIsDirty,
    withResolver: true,
  })

  // ...

  return (
    <>
      {/* ... */}
      {status === 'blocked' && (
        <div>
          <p>You are navigating to {next.pathname}</p>
          <p>Are you sure you want to leave?</p>
          <button onClick={proceed}>Yes</button>
          <button onClick={reset}>No</button>
        </div>
      )}
    </>
}
```

### Conditional blocking

```tsx
import { useBlocker } from '@tanstack/react-router'

function MyComponent() {
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: ({ next }) => {
      return !next.pathname.includes('step/')
    },
    withResolver: true,
  })

  // ...

  return (
    <>
      {/* ... */}
      {status === 'blocked' && (
        <div>
          <p>Are you sure you want to leave?</p>
          <button onClick={proceed}>Yes</button>
          <button onClick={reset}>No</button>
        </div>
      )}
    </>
  )
}
```

### Without resolver

```tsx
import { useBlocker } from '@tanstack/react-router'

function MyComponent() {
  const [formIsDirty, setFormIsDirty] = useState(false)

  useBlocker({
    shouldBlockFn: ({ next }) => {
      if (next.pathname.includes('step/')) {
        return false
      }

      const shouldLeave = confirm('Are you sure you want to leave?')
      return !shouldLeave
    },
  })

  // ...
}
```

### Type narrowing

```tsx
import { useBlocker } from '@tanstack/react-router'

function MyComponent() {
  const [formIsDirty, setFormIsDirty] = useState(false)

  // block going from editor-1 to /foo/123?hello=world
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (
        current.routeId === '/editor-1' &&
        next.fullPath === '/foo/$id' &&
        next.params.id === '123' &&
        next.search.hello === 'world'
      ) {
        return true
      }
      return false
    },
    enableBeforeUnload: false,
    withResolver: true,
  })

  // ...
}
```
