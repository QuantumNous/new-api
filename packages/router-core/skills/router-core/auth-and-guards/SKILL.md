---
name: router-core/auth-and-guards
description: >-
  Route protection with beforeLoad, redirect()/throw redirect(),
  isRedirect helper, authenticated layout routes (_authenticated),
  non-redirect auth (inline login), RBAC with roles and permissions,
  auth provider integration (Auth0, Clerk, Supabase), router context
  for auth state.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
  - router-core/data-loading
sources:
  - TanStack/router:docs/router/guide/authenticated-routes.md
  - TanStack/router:docs/router/how-to/setup-authentication.md
  - TanStack/router:docs/router/how-to/setup-auth-providers.md
  - TanStack/router:docs/router/how-to/setup-rbac.md
---

# Auth and Guards

> **This skill covers the routing side of auth.** Route guards are UX and navigation control; the data/API boundary still belongs in the server function, server route, or API endpoint that reads or mutates private data. For the **server-side primitives** — session cookies (`HttpOnly`/`Secure`/`SameSite`), `useSession`-style helpers, OAuth `state` + PKCE, password-reset enumeration defense, CSRF, rate limiting — see [start-core/auth-server-primitives](../../../../start-client-core/skills/start-core/auth-server-primitives/SKILL.md).
>
> **CRITICAL**: A route guard (`beforeLoad`) does NOT protect a `createServerFn` declared on that route. Server functions are API endpoints reachable independently of the route that calls them. See "Route guards do not protect server functions" below.

## Setup

Protect routes with `beforeLoad` + `redirect()` in a pathless layout route (`_authenticated`):

```tsx
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
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
  // component defaults to Outlet — no need to declare it
})
```

Any route file placed under `src/routes/_authenticated/` is automatically protected:

```tsx
// src/routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { auth } = Route.useRouteContext()
  return <div>Welcome, {auth.user?.username}</div>
}
```

## Core Patterns

### Router Context for Auth State

Auth state flows into the router via `createRootRouteWithContext` and `RouterProvider`'s `context` prop:

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

interface AuthState {
  isAuthenticated: boolean
  user: { id: string; username: string; email: string } | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

interface MyRouterContext {
  auth: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
})
```

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // placeholder — filled by RouterProvider context prop
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

```tsx
// src/App.tsx
import { RouterProvider } from '@tanstack/react-router'
import { AuthProvider, useAuth } from './auth'
import { router } from './router'

function InnerApp() {
  const auth = useAuth()
  // context prop injects live auth state WITHOUT recreating the router
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

The router is created once with a placeholder. `RouterProvider`'s `context` prop injects the live auth state on each render — this avoids recreating the router on auth changes (which would reset caches and rebuild the route tree).

### Redirect-Based Auth with Redirect-Back

Save the current location in search params so you can redirect back after login:

```tsx
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
})
```

```tsx
// src/routes/login.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

// Validate redirect target to prevent open redirect attacks
function sanitizeRedirect(url: unknown): string {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return '/'
  }
  return url
}

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect })
    }
  },
  component: LoginComponent,
})

function LoginComponent() {
  const { auth } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await auth.login(username, password)
      navigate({ to: search.redirect })
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div>{error}</div>}
      <input value={username} onChange={(e) => setUsername(e.target.value)} />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Sign In</button>
    </form>
  )
}
```

### Non-Redirect Auth (Inline Login)

Instead of redirecting, show a login form in place of the `Outlet`:

```tsx
// src/routes/_authenticated.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { auth } = Route.useRouteContext()

  if (!auth.isAuthenticated) {
    return <LoginForm />
  }

  return <Outlet />
}
```

This keeps the URL unchanged — the user stays on the same page and sees a login form instead of protected content. After authentication, `<Outlet />` renders and child routes appear.

### RBAC with Roles and Permissions

Extend auth state with role/permission helpers, then check in `beforeLoad`:

```tsx
// src/auth.tsx
interface User {
  id: string
  username: string
  email: string
  roles: string[]
  permissions: string[]
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}
```

Admin-only layout route:

```tsx
// src/routes/_authenticated/_admin.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.hasRole('admin')) {
      throw redirect({
        to: '/unauthorized',
        search: { redirect: location.href },
      })
    }
  },
})
```

Multi-role access:

```tsx
// src/routes/_authenticated/_moderator.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_moderator')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.hasAnyRole(['admin', 'moderator'])) {
      throw redirect({
        to: '/unauthorized',
        search: { redirect: location.href },
      })
    }
  },
})
```

Permission-based:

```tsx
// src/routes/_authenticated/_users.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_users')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.hasAnyPermission(['users:read', 'users:write'])) {
      throw redirect({
        to: '/unauthorized',
        search: { redirect: location.href },
      })
    }
  },
})
```

Page-level permission check (nested under an already-role-protected layout):

```tsx
// src/routes/_authenticated/_users/manage.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_users/manage')({
  beforeLoad: ({ context }) => {
    if (!context.auth.hasPermission('users:write')) {
      throw new Error('Write permission required')
    }
  },
  component: UserManagement,
})

function UserManagement() {
  const { auth } = Route.useRouteContext()
  const canDelete = auth.hasPermission('users:delete')

  return (
    <div>
      <h1>User Management</h1>
      {canDelete && <button>Delete User</button>}
    </div>
  )
}
```

### Handling Auth Check Failures (isRedirect)

When `beforeLoad` has a try/catch, redirects (which work by throwing) can get swallowed. Use `isRedirect` to re-throw:

```tsx
import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    try {
      const user = await verifySession(context.auth)
      if (!user) {
        throw redirect({
          to: '/login',
          search: { redirect: location.href },
        })
      }
      return { user }
    } catch (error) {
      if (isRedirect(error)) throw error // re-throw redirect, don't swallow it
      // Actual error — redirect to login
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
})
```

## Common Mistakes

### CRITICAL: Route guards do not protect server functions

A `beforeLoad` redirect protects the **route's UI**, not the **server functions** declared on it. `createServerFn` produces an RPC endpoint reachable by direct POST regardless of which route renders the calling UI. An attacker doesn't have to load `/_authenticated/orders` — they can curl the RPC endpoint directly.

```tsx
// WRONG — handler has no auth check; the route guard doesn't help
import { createServerFn } from '@tanstack/react-start'
import { createFileRoute, redirect } from '@tanstack/react-router'

const getMyOrders = createServerFn({ method: 'GET' }).handler(async () => {
  return db.orders.findMany() // ← anyone can hit the RPC
})

export const Route = createFileRoute('/_authenticated/orders')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' })
  },
  loader: () => getMyOrders(),
})
```

```tsx
// CORRECT — auth enforced on the handler itself, via middleware
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '~/server/auth-middleware'

const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return db.orders.findMany({ where: { userId: context.session.userId } })
  })
```

Rule of thumb: every `createServerFn`, server route, or API endpoint that touches user data needs `authMiddleware` (or an equivalent in-handler check). The route guard is for the page experience; the endpoint guard is for the data. See [start-core/auth-server-primitives](../../../../start-client-core/skills/start-core/auth-server-primitives/SKILL.md) for the full session/middleware pattern.

### HIGH: Auth check in component instead of beforeLoad

Component-level auth checks cause a **flash of protected content** before the redirect:

```tsx
// WRONG — protected content renders briefly before redirect
export const Route = createFileRoute('/_authenticated/dashboard')({
  component: () => {
    const auth = useAuth()
    if (!auth.isAuthenticated) return <Navigate to="/login" />
    return <Dashboard />
  },
})

// CORRECT — beforeLoad runs before any rendering
export const Route = createFileRoute('/_authenticated/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: Dashboard,
})
```

`beforeLoad` runs before any component rendering and before the loader. It completely prevents the flash.

### HIGH: Not re-throwing redirects in try/catch

`redirect()` works by throwing. If `beforeLoad` has a try/catch, the redirect gets swallowed:

```tsx
// WRONG — redirect is caught and swallowed
beforeLoad: async ({ context }) => {
  try {
    await validateSession(context.auth)
  } catch (e) {
    console.error(e) // swallows the redirect!
  }
}

// CORRECT — use isRedirect to distinguish intentional redirects from errors
import { isRedirect } from '@tanstack/react-router'

beforeLoad: async ({ context }) => {
  try {
    await validateSession(context.auth)
  } catch (e) {
    if (isRedirect(e)) throw e
    console.error(e)
  }
}
```

### MEDIUM: Conditionally rendering root route component

The root route always renders regardless of auth state. You cannot conditionally render its component:

```tsx
// WRONG — root route always renders, this doesn't protect anything
export const Route = createRootRoute({
  component: () => {
    if (!isAuthenticated()) return <Login />
    return <Outlet />
  },
})

// CORRECT — use a pathless layout route for auth boundaries
// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
})
```

Place protected routes as children of the `_authenticated` layout route. Public routes (login, home, etc.) live outside it.

---

## Cross-References

- See also: **router-core/data-loading/SKILL.md** — `beforeLoad` runs before `loader`; auth context flows into loader via route context
- See also: **start-core/auth-server-primitives/SKILL.md** — server-side session cookies, OAuth state + PKCE, CSRF, password-reset hardening, rate limiting (the server half of authentication)
- See also: **start-core/middleware/SKILL.md** — `authMiddleware` factory pattern for protecting individual `createServerFn` calls
