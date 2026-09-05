---
id: createRouteMaskFunction
title: createRouteMask function
---

The `createRouteMask` function is a helper function that can be used to create a route mask configuration that can be passed to the `RouterOptions.routeMasks` option.

## createRouteMask options

- Type: [`RouteMask`](./RouteMaskType.md)
- Required
- The options that will be used to configure the route mask

## createRouteMask returns

- A object with the type signature of [`RouteMask`](./RouteMaskType.md) that can be passed to the `RouterOptions.routeMasks` option.

## Examples

```tsx
import { createRouteMask, createRouter } from '@tanstack/react-router'

const photoModalToPhotoMask = createRouteMask({
  routeTree,
  from: '/photos/$photoId/modal',
  to: '/photos/$photoId',
  params: true,
})

// Set up a Router instance
const router = createRouter({
  routeTree,
  routeMasks: [photoModalToPhotoMask],
})
```
