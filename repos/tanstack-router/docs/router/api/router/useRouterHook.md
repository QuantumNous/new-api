---
id: useRouterHook
title: useRouter hook
---

The `useRouter` method is a hook that returns the current instance of [`Router`](./RouterType.md) from context. This hook is useful for accessing the router instance in a component.

## useRouter returns

- The current [`Router`](./RouterType.md) instance.

> ⚠️⚠️⚠️ **`router.state` is always up to date, but NOT REACTIVE. If you use `router.state` in a component, the component will not re-render when the router state changes. To get a reactive version of the router state, use the [`useRouterState`](./useRouterStateHook.md) hook.**

## Examples

```tsx
import { useRouter } from '@tanstack/react-router'

function Component() {
  const router = useRouter()
  //    ^ Router

  // ...
}
```
