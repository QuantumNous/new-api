---
id: RouterStateType
title: RouterState type
---

The `RouterState` type represents shape of the internal state of the router. The Router's internal state is useful, if you need to access certain internals of the router, such as any pending matches, is the router in its loading state, etc.

```tsx
type RouterState = {
  status: 'pending' | 'idle'
  isLoading: boolean
  isTransitioning: boolean
  matches: Array<RouteMatch>
  location: ParsedLocation
  resolvedLocation: ParsedLocation
}
```

## RouterState properties

The `RouterState` type contains all of the properties that are available on the router state.

### `status` property

- Type: `'pending' | 'idle'`
- The current status of the router. If the router is pending, it means that it is currently loading a route or the router is still transitioning to the new route.

### `isLoading` property

- Type: `boolean`
- `true` if the router is currently loading a route or waiting for a route to finish loading.

### `isTransitioning` property

- Type: `boolean`
- `true` if the router is currently transitioning to a new route.

### `matches` property

- Type: [`Array<RouteMatch>`](./RouteMatchType.md)
- An array of all of the route matches that have been resolved and are currently active.

### `location` property

- Type: [`ParsedLocation`](./ParsedLocationType.md)
- The latest location that the router has parsed from the browser history. This location may not be resolved and loaded yet.

### `resolvedLocation` property

- Type: [`ParsedLocation`](./ParsedLocationType.md)
- The location that the router has resolved and loaded.
