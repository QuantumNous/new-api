---
id: authentication
title: Authentication
---

This guide covers authentication patterns and shows how to implement your own authentication system with TanStack Start.

> **📋 Before You Start:** Check our [Authentication Overview](./authentication-overview.md) for all available options including partner solutions and hosted services.

## Authentication Approaches

You have several options for authentication in your TanStack Start application:

**Hosted Solutions:**

1. **[Clerk](https://clerk.dev)** - Complete authentication platform with UI components
2. **[WorkOS](https://workos.com)** - Enterprise-focused with SSO and compliance features
3. **[Better Auth](https://www.better-auth.com/)** - Open-source TypeScript library
4. **[Auth.js](https://authjs.dev/)** - Open-source library supporting 80+ OAuth providers

**DIY Implementation Benefits:**

- **Full Control**: Complete customization over authentication flow
- **No Vendor Lock-in**: Own your authentication logic and user data
- **Custom Requirements**: Implement specific business logic or compliance needs
- **Cost Control**: No per-user pricing or usage limits

Authentication involves many considerations including password security, session management, rate limiting, CSRF protection, and various attack vectors.

## Core Concepts

### Authentication vs Authorization

- **Authentication**: Who is this user? (Login/logout)
- **Authorization**: What can this user do? (Permissions/roles)

TanStack Start provides the tools for both through server functions, sessions, and route protection.

> Protect the data/API boundary first. Any server function, server route, or other API endpoint that returns or mutates private data must authorize the request itself. `beforeLoad` is useful for route UX: it keeps users out of screens they cannot use and avoids triggering work that would fail anyway. It is not the security boundary for the data. See [Authentication Server Primitives](./authentication-server-primitives.md) for the server-side pattern.

## Essential Building Blocks

### 1. Server Functions for Authentication

Server functions handle sensitive authentication logic securely on the server:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

// Login server function
export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    // Verify credentials (replace with your auth logic)
    const user = await authenticateUser(data.email, data.password)

    if (!user) {
      return { error: 'Invalid credentials' }
    }

    // Create session
    const session = await useAppSession()
    await session.update({
      userId: user.id,
      email: user.email,
    })

    // Redirect to protected area
    throw redirect({ to: '/dashboard' })
  })

// Logout server function
export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useAppSession()
  await session.clear()
  throw redirect({ to: '/' })
})

// Get current user
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await useAppSession()
    const userId = session.data.userId

    if (!userId) {
      return null
    }

    return await getUserById(userId)
  },
)
```

### 2. Session Management

TanStack Start provides secure HTTP-only cookie sessions:

```tsx
// utils/session.ts
import { useSession } from '@tanstack/react-start/server'

type SessionData = {
  userId?: string
  email?: string
  role?: string
}

export function useAppSession() {
  return useSession<SessionData>({
    // Session configuration
    name: 'app-session',
    password: process.env.SESSION_SECRET!, // At least 32 characters
    // Optional: customize cookie settings
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  })
}
```

### 3. Authentication Context

Share authentication state across your application:

```tsx
// contexts/auth.tsx
import { createContext, useContext, ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getCurrentUserFn } from '../server/auth'

type User = {
  id: string
  email: string
  role: string
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = useServerFn(getCurrentUserFn)

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### 4. Route Protection

Protect routes using `beforeLoad`:

```tsx
// routes/_authed.tsx - Layout route for protected pages
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUserFn } from '../server/auth'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn()

    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }

    // Pass user to child routes
    return { user }
  },
})
```

```tsx
// routes/_authed/dashboard.tsx - Protected route
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { user } = Route.useRouteContext()

  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      {/* Dashboard content */}
    </div>
  )
}
```

## Implementation Patterns

### Basic Email/Password Authentication

```tsx
// server/auth.ts
import bcrypt from 'bcryptjs'
import { createServerFn } from '@tanstack/react-start'

// User registration
export const registerFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string; name: string }) => data)
  .handler(async ({ data }) => {
    // Check if user exists
    const existingUser = await getUserByEmail(data.email)
    if (existingUser) {
      return { error: 'User already exists' }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12)

    // Create user
    const user = await createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name,
    })

    // Create session
    const session = await useAppSession()
    await session.update({ userId: user.id })

    return { success: true, user: { id: user.id, email: user.email } }
  })

async function authenticateUser(email: string, password: string) {
  const user = await getUserByEmail(email)
  if (!user) return null

  const isValid = await bcrypt.compare(password, user.password)
  return isValid ? user : null
}
```

### Role-Based Access Control (RBAC)

```tsx
// utils/auth.ts
export const roles = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const

type Role = (typeof roles)[keyof typeof roles]

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  const hierarchy = {
    [roles.USER]: 0,
    [roles.MODERATOR]: 1,
    [roles.ADMIN]: 2,
  }

  return hierarchy[userRole] >= hierarchy[requiredRole]
}

// Protected route with role check
export const Route = createFileRoute('/_authed/admin/')({
  beforeLoad: async ({ context }) => {
    if (!hasPermission(context.user.role, roles.ADMIN)) {
      throw redirect({ to: '/unauthorized' })
    }
  },
})
```

### Social Authentication Integration

```tsx
// Example with OAuth providers
export const authProviders = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri: `${process.env.APP_URL}/auth/google/callback`,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    redirectUri: `${process.env.APP_URL}/auth/github/callback`,
  },
}

export const initiateOAuthFn = createServerFn({ method: 'POST' })
  .validator((data: { provider: 'google' | 'github' }) => data)
  .handler(async ({ data }) => {
    const provider = authProviders[data.provider]
    const state = generateRandomState()

    // Store state in session for CSRF protection
    const session = await useAppSession()
    await session.update({ oauthState: state })

    // Generate OAuth URL
    const authUrl = generateOAuthUrl(provider, state)

    throw redirect({ href: authUrl })
  })
```

### Password Reset Flow

```tsx
// Password reset request
export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const user = await getUserByEmail(data.email)
    if (!user) {
      // Don't reveal if email exists
      return { success: true }
    }

    const token = generateSecureToken()
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await savePasswordResetToken(user.id, token, expires)
    await sendPasswordResetEmail(user.email, token)

    return { success: true }
  })

// Password reset confirmation
export const resetPasswordFn = createServerFn({ method: 'POST' })
  .validator((data: { token: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const resetToken = await getPasswordResetToken(data.token)

    if (!resetToken || resetToken.expires < new Date()) {
      return { error: 'Invalid or expired token' }
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12)
    await updateUserPassword(resetToken.userId, hashedPassword)
    await deletePasswordResetToken(data.token)

    return { success: true }
  })
```

## Security Best Practices

### 1. Password Security

```tsx
// Use strong hashing (bcrypt, scrypt, or argon2)
import bcrypt from 'bcryptjs'

const saltRounds = 12 // Adjust based on your security needs
const hashedPassword = await bcrypt.hash(password, saltRounds)
```

### 2. Session Security

```tsx
// Use secure session configuration
export function useAppSession() {
  return useSession({
    name: 'app-session',
    password: process.env.SESSION_SECRET!, // 32+ characters
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      httpOnly: true, // XSS protection
      maxAge: 7 * 24 * 60 * 60, // 7 days
    },
  })
}
```

### 3. Rate Limiting

```tsx
// Simple in-memory rate limiting (use Redis in production)
const loginAttempts = new Map<string, { count: number; resetTime: number }>()

export const rateLimitLogin = (ip: string): boolean => {
  const now = Date.now()
  const attempts = loginAttempts.get(ip)

  if (!attempts || now > attempts.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }) // 15 min
    return true
  }

  if (attempts.count >= 5) {
    return false // Too many attempts
  }

  attempts.count++
  return true
}
```

### 4. Input Validation

```tsx
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
})

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    // data is now validated
  })
```

## Testing Authentication

### Unit Testing Server Functions

```tsx
// __tests__/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loginFn } from '../server/auth'

describe('Authentication', () => {
  beforeEach(async () => {
    await setupTestDatabase()
  })

  it('should login with valid credentials', async () => {
    const result = await loginFn({
      data: { email: 'test@example.com', password: 'password123' },
    })

    expect(result.error).toBeUndefined()
    expect(result.user).toBeDefined()
  })

  it('should reject invalid credentials', async () => {
    const result = await loginFn({
      data: { email: 'test@example.com', password: 'wrongpassword' },
    })

    expect(result.error).toBe('Invalid credentials')
  })
})
```

### Integration Testing

```tsx
// __tests__/auth-flow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { router } from '../router'

describe('Authentication Flow', () => {
  it('should redirect to login when accessing protected route', async () => {
    const history = createMemoryHistory()
    history.push('/dashboard') // Protected route

    render(<RouterProvider router={router} history={history} />)

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument()
    })
  })
})
```

## Common Patterns

### Loading States

```tsx
function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const loginMutation = useServerFn(loginFn)

  const handleSubmit = async (data: LoginData) => {
    setIsLoading(true)
    try {
      await loginMutation.mutate(data)
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}
```

### Remember Me Functionality

```tsx
export const loginFn = createServerFn({ method: 'POST' })
  .validator(
    (data: { email: string; password: string; rememberMe?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const user = await authenticateUser(data.email, data.password)
    if (!user) return { error: 'Invalid credentials' }

    const session = await useAppSession()
    await session.update(
      { userId: user.id },
      {
        // Extend session if remember me is checked
        maxAge: data.rememberMe ? 30 * 24 * 60 * 60 : undefined, // 30 days vs session
      },
    )

    return { success: true }
  })
```

## Working Examples

Study these implementations to understand different authentication patterns:

- **[Basic Auth with Prisma](https://github.com/TanStack/router/tree/main/examples/react/start-basic-auth)** - Complete DIY implementation with database and sessions
- **[Supabase Integration](https://github.com/TanStack/router/tree/main/examples/react/start-supabase-basic)** - Third-party service integration example
- **[Client-side Context Auth](https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes)** - Client-only authentication patterns

## Migration from Other Solutions

### From Client-Side Auth

If you're migrating from client-side authentication (localStorage, context only):

1. Move authentication logic to server functions
2. Replace localStorage with server sessions
3. Update route protection to use `beforeLoad`
4. Add proper security headers and CSRF protection

### From Other Frameworks

- **Next.js**: Replace API routes with server functions, migrate NextAuth sessions
- **Remix**: Convert loaders/actions to server functions, adapt session patterns
- **SvelteKit**: Move form actions to server functions, update route protection

## Production Considerations

When choosing your authentication approach, consider these factors:

### Hosted vs DIY Comparison

**Hosted Solutions (Clerk, WorkOS, Better Auth):**

- Pre-built security measures and regular updates
- UI components and user management features
- Compliance certifications and audit trails
- Support and documentation
- Per-user or subscription pricing

**DIY Implementation:**

- Complete control over implementation and data
- No ongoing subscription costs
- Custom business logic and workflows
- Responsibility for security updates and monitoring
- Need to handle edge cases and attack vectors

### Security Considerations

Authentication systems need to handle various security aspects:

- Password hashing and timing attack prevention
- Session management and fixation protection
- CSRF and XSS protection
- Rate limiting and brute force prevention
- OAuth flow security
- Compliance requirements (GDPR, CCPA, etc.)

## Next Steps

When implementing authentication, consider:

- **Security Review**: Review your implementation for security best practices
- **Performance**: Add caching for user lookups and session validation
- **Monitoring**: Add logging and monitoring for authentication events
- **Compliance**: Ensure compliance with relevant regulations if storing personal data

For other authentication approaches, check the [Authentication Overview](./authentication-overview.md). For specific integration help, explore our [working examples](https://github.com/TanStack/router/tree/main/examples/react).
