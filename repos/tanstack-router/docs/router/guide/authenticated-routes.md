---
id: authenticated-routes
title: Authenticated Routes
---

Authentication is an extremely common requirement for web applications. In this guide, we'll walk through how to use TanStack Router to build protected routes, and how to redirect users to login if they try to access them.

> **A route guard is not a data authorization boundary.** This guide shows how to gate a route's UI behind `beforeLoad`. Any server function, server route, or API endpoint that returns private data must authorize the request itself, because it can be requested independently of the route that calls it. See [Authentication Server Primitives](../../start/framework/react/guide/authentication-server-primitives.md) in the Start docs.

## The `route.beforeLoad` Option

The `route.beforeLoad` option allows you to specify a function that will be called before a route is loaded. It receives all of the same arguments that the `route.loader` function does. This is a great place to check if a user is authenticated, and redirect them to a login page if they are not.

The `beforeLoad` function runs in relative order to these other route loading functions:

- Route Matching (Top-Down)
  - `route.params.parse`
  - `route.validateSearch`
- Route Loading (including Preloading)
  - **`route.beforeLoad`**
  - `route.onError`
- Route Loading (Parallel)
  - `route.component.preload?`
  - `route.load`

**It's important to know that the `beforeLoad` function for a route is called _before any of its child routes' `beforeLoad` functions_.** It is essentially a middleware function for the route and all of its children.

**If you throw an error in `beforeLoad`, none of its children will attempt to load**.

## Redirecting

While not required, some authentication flows require redirecting to a login page. To do this, you can **throw a `redirect()`** from `beforeLoad`:

```tsx
// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: {
          // Use the current location to power a redirect after login
          // (Do not use `router.state.resolvedLocation` as it can
          // potentially lag behind the actual current location)
          redirect: location.href,
        },
      })
    }
  },
})
```

> [!TIP]
> The `redirect()` function takes all of the same options as the `navigate` function, so you can pass options like `replace: true` if you want to replace the current history entry instead of adding a new one.

### Handling Auth Check Failures

If your authentication check can throw errors (network failures, token validation, etc.), wrap it in try/catch:

<!-- ::start:framework -->

# React

```tsx
import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router'

// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    try {
      const user = await verifySession() // might throw on network error
      if (!user) {
        throw redirect({
          to: '/login',
          search: { redirect: location.href },
        })
      }
      return { user }
    } catch (error) {
      // Re-throw redirects (they're intentional, not errors)
      if (isRedirect(error)) throw error

      // Auth check failed (network error, etc.) - redirect to login
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
})
```

# Solid

```tsx
import { createFileRoute, redirect, isRedirect } from '@tanstack/solid-router'

// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    try {
      const user = await verifySession() // might throw on network error
      if (!user) {
        throw redirect({
          to: '/login',
          search: { redirect: location.href },
        })
      }
      return { user }
    } catch (error) {
      // Re-throw redirects (they're intentional, not errors)
      if (isRedirect(error)) throw error

      // Auth check failed (network error, etc.) - redirect to login
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
})
```

<!-- ::end:framework -->

The [`isRedirect()`](../api/router/isRedirectFunction.md) helper distinguishes between actual errors and intentional redirects.

Once you have authenticated a user, it's also common practice to redirect them back to the page they were trying to access. To do this, you can utilize the `redirect` search param that we added in our original redirect. Since we'll be replacing the entire URL with what it was, `router.history.push` is better suited for this than `router.navigate`:

```tsx
router.history.push(search.redirect)
```

## Non-Redirected Authentication

Some applications choose to not redirect users to a login page, and instead keep the user on the same page and show a login form that either replaces the main content or hides it via a modal. This is also possible with TanStack Router by simply short circuiting rendering the `<Outlet />` that would normally render the child routes:

```tsx
// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  component: () => {
    if (!isAuthenticated()) {
      return <Login />
    }

    return <Outlet />
  },
})
```

This keeps the user on the same page, but still allows you to render a login form. Once the user is authenticated, you can simply render the `<Outlet />` and the child routes will be rendered.

## Authentication using React context/hooks

If your authentication flow relies on interactions with React context and/or hooks, you'll need to pass down your authentication state to TanStack Router using `router.context` option.

> [!IMPORTANT]
> React hooks are not meant to be consumed outside of React components. If you need to use a hook outside of a React component, you need to extract the returned state from the hook in a component that wraps your `<RouterProvider />` and then pass the returned value down to TanStack Router.

We'll cover the `router.context` options in-detail in the [Router Context](./router-context.md) section.

Here's an example that uses React context and hooks for protecting authenticated routes in TanStack Router. See the entire working setup in the [Authenticated Routes example](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes).

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/__root.tsx"
import { createRootRouteWithContext } from '@tanstack/react-router'

interface MyRouterContext {
  // The ReturnType of your useAuth hook or the value of your AuthContext
  auth: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
})
```

```tsx title="src/router.tsx"
import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: {
    // auth will initially be undefined
    // We'll be passing down the auth state from within a React component
    auth: undefined!,
  },
})
```

```tsx title="src/App.tsx"
import { RouterProvider } from '@tanstack/react-router'

import { AuthProvider, useAuth } from './auth'

import { router } from './router'

function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/__root.tsx"
import { createRootRouteWithContext } from '@tanstack/solid-router'

interface MyRouterContext {
  // The ReturnType of your useAuth hook or the value of your AuthContext
  auth: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
})
```

```tsx title="src/router.tsx"
import { createRouter } from '@tanstack/solid-router'

import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: {
    // auth will initially be undefined
    // We'll be passing down the auth state from within a React component
    auth: undefined!,
  },
})
```

```tsx title="src/App.tsx"
import { RouterProvider } from '@tanstack/solid-router'

import { AuthProvider, useAuth } from './auth'

import { router } from './router'

function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

Then in the authenticated route, you can check the auth state using the `beforeLoad` function, and **throw a `redirect()`** to your **Login route** if the user is not signed-in.

<!-- ::start:framework -->

# React

```tsx title="src/routes/dashboard.route.tsx"
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
})
```

# Solid

```tsx title="src/routes/dashboard.route.tsx"
import { createFileRoute, redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
})
```

<!-- ::end:framework -->

You can _optionally_, also use the [Non-Redirected Authentication](#non-redirected-authentication) approach to show a login form instead of calling a **redirect**.

This approach can also be used in conjunction with Pathless or Layout Route to protect all routes under their parent route.

## Related How-To Guides

For detailed, step-by-step implementation guides, see:

- [How to Set Up Basic Authentication](../how-to/setup-authentication.md) - Complete setup with React Context and protected routes
- [How to Integrate Authentication Providers](../how-to/setup-auth-providers.md) - Use Auth0, Clerk, or Supabase
- [How to Set Up Role-Based Access Control](../how-to/setup-rbac.md) - Implement permissions and role-based routing

## Examples

Working authentication examples are available in the repository:

- [Basic Authentication Example](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes) - Simple authentication with context
- [Firebase Authentication](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes-firebase) - Firebase Auth integration
- [TanStack Start Auth Examples](https://github.com/TanStack/router/tree/main/examples/react) - Various auth implementations with TanStack Start
