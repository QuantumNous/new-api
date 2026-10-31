---
id: RouteType
title: Route type
---

The `Route` type is used to describe a route instance.

## `Route` properties and methods

An instance of the `Route` has the following properties and methods:

### `.addChildren` method

- Type: `(children: Route[]) => this`
- Adds child routes to the route instance and returns the route instance (but with updated types to reflect the new children).

### `.update` method

- Type: `(options: Partial<UpdatableRouteOptions>) => this`
- Updates the route instance with new options and returns the route instance (but with updated types to reflect the new options).
- In some circumstances, it can be useful to update a route instance's options after it has been created to avoid circular type references.
- ...`RouteApi` methods

### `.lazy` method

- Type: `(lazyImporter: () => Promise<Partial<UpdatableRouteOptions>>) => this`
- Updates the route instance with a new lazy importer which will be resolved lazily when loading the route. This can be useful for code splitting.

### `.redirect` method

- Type: `(opts?: RedirectOptions) => Redirect`
- A type-safe version of the [`redirect`](./redirectFunction.md) function that is pre-bound to the route's path.
- The `from` parameter is automatically set to the route's `fullPath`, enabling type-safe relative redirects.
- See [`RouteApi.redirect`](./RouteApiType.md#redirect-method) for more details.

#### Example

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      // Type-safe redirect - 'from' is automatically '/dashboard/settings'
      throw Route.redirect({
        to: '../login', // Relative path to sibling route
      })
    }
  },
})
```

### ...`RouteApi` methods

- All of the methods from [`RouteApi`](./RouteApiType.md) are available.
