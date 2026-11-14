---
title: How to Set Up Authentication Providers
---

This guide covers integrating popular authentication services (Auth0, Clerk, Supabase) with TanStack Router.

## Quick Start

Choose an authentication provider, install their SDK, wrap your router with their context, and adapt their auth state to work with TanStack Router's context system.

---

## Auth0 Integration

### 1. Install Auth0

```bash
npm install @auth0/auth0-react
```

### 2. Set Up Environment Variables

Add to your `.env` file:

```env
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your_auth0_client_id
```

### 3. Create Auth0 Wrapper

Create `src/auth/auth0.tsx`:

```tsx
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'
import { createContext, useContext } from 'react'

interface Auth0ContextType {
  isAuthenticated: boolean
  user: any
  login: () => void
  logout: () => void
  isLoading: boolean
}

const Auth0Context = createContext<Auth0ContextType | undefined>(undefined)

export function Auth0Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <Auth0ContextProvider>{children}</Auth0ContextProvider>
    </Auth0Provider>
  )
}

function Auth0ContextProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } =
    useAuth0()

  const contextValue = {
    isAuthenticated,
    user,
    login: loginWithRedirect,
    logout: () =>
      logout({ logoutParams: { returnTo: window.location.origin } }),
    isLoading,
  }

  return (
    <Auth0Context.Provider value={contextValue}>
      {children}
    </Auth0Context.Provider>
  )
}

export function useAuth0Context() {
  const context = useContext(Auth0Context)
  if (context === undefined) {
    throw new Error('useAuth0Context must be used within Auth0Wrapper')
  }
  return context
}
```

### 4. Update App Configuration

Update `src/App.tsx`:

```tsx
import { RouterProvider } from '@tanstack/react-router'
import { Auth0Wrapper, useAuth0Context } from './auth/auth0'
import { router } from './router'

function InnerApp() {
  const auth = useAuth0Context()

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth }} />
}

function App() {
  return (
    <Auth0Wrapper>
      <InnerApp />
    </Auth0Wrapper>
  )
}

export default App
```

### 5. Create Protected Routes

Create `src/routes/_authenticated.tsx`:

```tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      // Auth0 handles login redirects, so just trigger login
      context.auth.login()
      return
    }
  },
  component: () => <Outlet />,
})
```

---

## Clerk Integration

### 1. Install Clerk

```bash
npm install @clerk/clerk-react
```

### 2. Set Up Environment Variables

Add to your `.env` file:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

### 3. Create Clerk Wrapper

Create `src/auth/clerk.tsx`:

```tsx
import { ClerkProvider, useUser, useAuth } from '@clerk/clerk-react'

export function ClerkWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  )
}

export function useClerkAuth() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()

  return {
    isAuthenticated: isSignedIn,
    user: user
      ? {
          id: user.id,
          username:
            user.username || user.primaryEmailAddress?.emailAddress || '',
          email: user.primaryEmailAddress?.emailAddress || '',
        }
      : null,
    isLoading: !isLoaded,
    login: () => {
      // Clerk handles login through components
      window.location.href = '/sign-in'
    },
    logout: () => {
      // Clerk handles logout through components
      window.location.href = '/sign-out'
    },
  }
}
```

### 4. Create Clerk Auth Routes

Create `src/routes/sign-in.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/clerk-react'

export const Route = createFileRoute('/sign-in')({
  component: () => (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn redirectUrl="/dashboard" signUpUrl="/sign-up" />
    </div>
  ),
})
```

Create `src/routes/sign-up.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/clerk-react'

export const Route = createFileRoute('/sign-up')({
  component: () => (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp redirectUrl="/dashboard" signInUrl="/sign-in" />
    </div>
  ),
})
```

### 5. Update App Configuration

Update `src/App.tsx`:

```tsx
import { RouterProvider } from '@tanstack/react-router'
import { ClerkWrapper, useClerkAuth } from './auth/clerk'
import { router } from './router'

function InnerApp() {
  const auth = useClerkAuth()

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth }} />
}

function App() {
  return (
    <ClerkWrapper>
      <InnerApp />
    </ClerkWrapper>
  )
}

export default App
```

### 6. Create Protected Routes

Create `src/routes/_authenticated.tsx`:

```tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: () => <Outlet />,
})
```

---

## Supabase Integration

### 1. Install Supabase

```bash
npm install @supabase/supabase-js
```

### 2. Set Up Environment Variables

Add to your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Create Supabase Client

Create `src/auth/supabase.tsx`:

```tsx
import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

interface SupabaseAuthState {
  isAuthenticated: boolean
  user: any
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
}

const SupabaseAuthContext = createContext<SupabaseAuthState | undefined>(
  undefined,
)

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsAuthenticated(!!session?.user)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsAuthenticated(!!session?.user)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <SupabaseAuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  )
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext)
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
  }
  return context
}
```

### 4. Create Login Component

Create `src/routes/login.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || '/dashboard',
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
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await auth.login(email, password)
      // Supabase auth will automatically update context
      window.location.href = redirect
    } catch (err: any) {
      setError(err.message || 'Login failed')
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
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
```

### 5. Update App Configuration

Update `src/App.tsx`:

```tsx
import { RouterProvider } from '@tanstack/react-router'
import { SupabaseAuthProvider, useSupabaseAuth } from './auth/supabase'
import { router } from './router'

function InnerApp() {
  const auth = useSupabaseAuth()

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth }} />
}

function App() {
  return (
    <SupabaseAuthProvider>
      <InnerApp />
    </SupabaseAuthProvider>
  )
}

export default App
```

---

## Provider Comparison

| Feature                 | Auth0    | Clerk     | Supabase |
| ----------------------- | -------- | --------- | -------- |
| **Setup Complexity**    | Medium   | Low       | Medium   |
| **UI Components**       | Basic    | Excellent | None     |
| **Customization**       | High     | Medium    | High     |
| **Pricing**             | Freemium | Freemium  | Freemium |
| **Social Login**        | ✅       | ✅        | ✅       |
| **Enterprise Features** | ✅       | ✅        | ✅       |
| **Database Included**   | ❌       | ❌        | ✅       |

### When to Choose Each:

- **Auth0**: Complex enterprise requirements, extensive customization
- **Clerk**: Quick setup with beautiful UI components
- **Supabase**: Full-stack solution with database and real-time features

---

## Common Problems

### Provider Context Not Available

**Problem:** Auth context is undefined in components.

**Solution:** Ensure the provider wrapper is above `RouterProvider`:

```tsx
// ✅ Correct order
<AuthProvider>
  <InnerApp>
    <RouterProvider />
  </InnerApp>
</AuthProvider>

// ❌ Wrong order
<RouterProvider>
  <AuthProvider />
</RouterProvider>
```

### Infinite Loading States

**Problem:** App stuck on loading screen.

**Solution:** Check if auth provider properly sets `isLoading` to `false`:

```tsx
// Add timeout fallback
useEffect(() => {
  const timeout = setTimeout(() => {
    if (isLoading) {
      setIsLoading(false)
    }
  }, 5000)
  return () => clearTimeout(timeout)
}, [isLoading])
```

### Redirect Loops with Auth0

**Problem:** Continuous redirects between login and protected routes.

**Solution:** Handle Auth0's automatic redirects properly:

```tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      context.auth.login()
      // Don't throw redirect, let Auth0 handle it
      return
    }
  },
  component: () => <Outlet />,
})
```

---

## Common Next Steps

After integrating authentication providers, you might want to:

- [How to Set Up Role-Based Access Control](./setup-rbac.md) - Add permission-based routing
- [How to Set Up Basic Authentication](./setup-authentication.md) - Custom auth implementation

<!-- TODO: Uncomment as how-to guides are created
- [How to Handle User Sessions](./handle-user-sessions.md)
- [How to Set Up Social Login](./setup-social-login.md)
-->

## Related Resources

- [Auth0 React SDK](https://auth0.com/docs/libraries/auth0-react) - Official Auth0 documentation
- [Clerk React SDK](https://clerk.com/docs/references/react/overview) - Official Clerk documentation
- [Supabase Auth](https://supabase.com/docs/guides/auth) - Official Supabase auth guide
