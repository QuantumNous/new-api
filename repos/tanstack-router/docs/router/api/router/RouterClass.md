---
id: RouterClass
title: Router Class
---

> [!CAUTION]
> This class has been deprecated and will be removed in the next major version of TanStack Router.
> Please use the [`createRouter`](./createRouterFunction.md) function instead.

The `Router` class is used to instantiate a new router instance.

## `Router` constructor

The `Router` constructor accepts a single argument: the `options` that will be used to configure the router instance.

### Constructor options

- Type: [`RouterOptions`](./RouterOptionsType.md)
- Required
- The options that will be used to configure the router instance.

### Constructor returns

- An instance of the [`Router`](./RouterType.md).

## Examples

```tsx
import { Router, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = new Router({
  routeTree,
  defaultPreload: 'intent',
})

export default function App() {
  return <RouterProvider router={router} />
}
```
