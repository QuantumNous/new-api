---
title: How to Set Up Basic Authentication and Protected Routes
---

This guide covers implementing basic authentication patterns and protecting routes in TanStack Router applications.

## Quick Start

Set up authentication by creating a context-aware router, implementing auth state management, and using `beforeLoad` for route protection. This guide focuses on the core authentication setup using React Context.

---

## Create Authentication Context

Create `src/auth.tsx`:

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: string
  username: string
  email: string
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Restore auth state on app load
  useEffect(() => {
    const token = localStorage.getItem('auth-token')
    if (token) {
      // Validate token with your API
      fetch('/api/validate-token', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => response.json())
        .then((userData) => {
          if (userData.valid) {
            setUser(userData.user)
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem('auth-token')
          }
        })
        .catch(() => {
          localStorage.removeItem('auth-token')
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  const login = async (username: string, password: string) => {
    // Replace with your authentication logic
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (response.ok) {
      const userData = await response.json()
      setUser(userData)
      setIsAuthenticated(true)
      // Store token for persistence
      localStorage.setItem('auth-token', userData.token)
    } else {
      throw new Error('Authentication failed')
    }
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('auth-token')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

---

## Configure Router Context

### 1. Set Up Router Context

Update `src/routes/__root.tsx`:

```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

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
  component: () => (
    <div>
      <Outlet />
      <TanStackRouterDevtools />
    </div>
  ),
})
```

### 2. Configure Router

Update `src/router.tsx`:

```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: {
    // auth will be passed down from App component
    auth: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

### 3. Connect App with Authentication

Update `src/App.tsx`:

```tsx
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

export default App
```

---

## Create Protected Routes

### 1. Create Authentication Layout Route

Create `src/routes/_authenticated.tsx`:

```tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          // Save current location for redirect after login
          redirect: location.href,
        },
      })
    }
  },
  component: () => <Outlet />,
})
```

### 2. Create Login Route

Create `src/routes/login.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || '/',
  }),
  beforeLoad: ({ context, search }) => {
    // Redirect if already authenticated
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect })
    }
  },
  component: LoginComponent,
})

function LoginComponent() {
  const { auth } = Route.useRouteContext()
  const { redirect } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await auth.login(username, password)
      // Navigate to the redirect URL using router navigation
      navigate({ to: redirect })
    } catch (err) {
      setError('Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="max-w-md w-full space-y-4 p-6 border rounded-lg"
      >
        <h1 className="text-2xl font-bold text-center">Sign In</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
```

### 3. Create Protected Dashboard

Create `src/routes/_authenticated/dashboard.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { auth } = Route.useRouteContext()

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button
          onClick={auth.logout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
        <p className="text-gray-600">
          Hello, <strong>{auth.user?.username}</strong>! You are successfully
          authenticated.
        </p>
        <p className="text-sm text-gray-500 mt-2">Email: {auth.user?.email}</p>
      </div>
    </div>
  )
}
```

---

## Add Authentication Persistence

Update your `AuthProvider` to restore authentication state on page refresh:

```tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Restore auth state on app load
  useEffect(() => {
    const token = localStorage.getItem('auth-token')
    if (token) {
      // Validate token with your API
      fetch('/api/validate-token', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => response.json())
        .then((userData) => {
          if (userData.valid) {
            setUser(userData.user)
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem('auth-token')
          }
        })
        .catch(() => {
          localStorage.removeItem('auth-token')
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  // ... rest of the provider logic
}
```

---

## Production Checklist

Before deploying authentication, ensure you have:

- [ ] Secured API endpoints with proper authentication middleware
- [ ] Set up HTTPS in production (required for secure cookies)
- [ ] Configured environment variables for API endpoints
- [ ] Implemented proper token validation and refresh
- [ ] Added CSRF protection for form-based authentication
- [ ] Tested authentication flows (login, logout, persistence)
- [ ] Added proper error handling for network failures
- [ ] Implemented loading states for auth operations

---

## Common Problems

### Authentication Context Not Available

**Problem:** `useAuth must be used within an AuthProvider` error.

**Solution:** Ensure `AuthProvider` wraps your entire app and `RouterProvider` is inside it.

### User Logged Out on Page Refresh

**Problem:** Authentication state resets when page refreshes.

**Solution:** Add token persistence as shown in the persistence section above.

### Protected Route Flashing Before Redirect

**Problem:** Protected content briefly shows before redirecting to login.

**Solution:** Use `beforeLoad` instead of component-level auth checks:

```tsx
export const Route = createFileRoute('/_authenticated/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardComponent,
})
```

---

## Common Next Steps

After setting up basic authentication, you might want to:

- [How to Integrate Authentication Providers](./setup-auth-providers.md) - Use Auth0, Clerk, or Supabase
- [How to Set Up Role-Based Access Control](./setup-rbac.md) - Add permission-based routing

<!-- TODO: Uncomment as how-to guides are created
- [How to Handle User Sessions](./handle-user-sessions.md)
- [How to Set Up Social Login](./setup-social-login.md)
-->

## Related Resources

- [Authenticated Routes Guide](../guide/authenticated-routes.md) - Detailed conceptual guide
- [Router Context Guide](../guide/router-context.md) - Understanding context in TanStack Router
- [Authentication Examples](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes) - Complete working examples
