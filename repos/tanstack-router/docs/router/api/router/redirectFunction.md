---
id: redirectFunction
title: redirect function
---

The `redirect` function returns a new `Redirect` object that can be either returned or thrown from places like a Route's `beforeLoad` or `loader` callbacks to trigger _redirect_ to a new location.

## redirect options

The `redirect` function accepts a single argument, the `options` to determine the redirect behavior.

- Type: [`Redirect`](./RedirectType.md)
- Required

## redirect returns

- If the `throw` property is `true` in the `options` object, the `Redirect` object will be thrown from within the function call.
- If the `throw` property is `false | undefined` in the `options` object, the `Redirect` object will be returned.

## Examples

### Using the standalone `redirect` function

```tsx
import { redirect } from '@tanstack/react-router'

const route = createRoute({
  // throwing an internal redirect object using 'to' property
  loader: () => {
    if (!user) {
      throw redirect({
        to: '/login',
      })
    }
  },
  // throwing an external redirect object using 'href' property
  loader: () => {
    if (needsExternalAuth) {
      throw redirect({
        href: 'https://authprovider.com/login',
      })
    }
  },
  // or forcing `redirect` to throw itself
  loader: () => {
    if (!user) {
      redirect({
        to: '/login',
        throw: true,
      })
    }
  },
  // ... other route options
})
```

### Using Route.redirect (File-Based Routes)

When using file-based routing with `createFileRoute`, you can use the `Route.redirect` method directly. This method automatically sets the `from` parameter based on the route's path, enabling type-safe relative redirects without manually specifying the origin route:

```tsx
// In routes/dashboard/settings.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      // Relative redirect - automatically knows we're redirecting from '/dashboard/settings'
      throw Route.redirect({
        to: '../login', // Redirects to '/dashboard/login'
      })
    }
  },
  loader: () => {
    // Also works in loader
    if (needsMigration) {
      throw Route.redirect({
        to: './migrate', // Redirects to '/dashboard/settings/migrate'
      })
    }
  },
})
```

### Using getRouteApi().redirect

For accessing the redirect method outside of the route definition file, you can use `getRouteApi`:

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/dashboard/settings')

// In a beforeLoad or loader callback
function checkAuth() {
  if (!user) {
    // Type-safe redirect with automatic 'from' parameter
    throw routeApi.redirect({
      to: '../login',
    })
  }
}
```

### Benefits of Route-Bound Redirect

Using `Route.redirect` or `getRouteApi().redirect` instead of the standalone `redirect` function offers several advantages:

1. **No need to specify `from`**: The route path is automatically used as the origin
2. **Type-safe relative paths**: TypeScript validates that relative paths like `../sibling` or `./child` resolve to valid routes
3. **Refactoring-friendly**: If the route path changes, the redirect origin updates automatically
