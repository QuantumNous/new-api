---
title: How to Set Up Role-Based Access Control
---

This guide covers implementing role-based access control (RBAC) and permission-based routing in TanStack Router applications.

## Quick Start

Extend your authentication context to include roles and permissions, create role-protected layout routes, and use `beforeLoad` to check user permissions before rendering routes.

---

## Extend Authentication Context

### 1. Add Roles to User Type

Update your authentication context to include roles:

```tsx
// src/auth.tsx
import React, { createContext, useContext, useState } from 'react'

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

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const hasRole = (role: string) => {
    return user?.roles.includes(role) ?? false
  }

  const hasAnyRole = (roles: string[]) => {
    return roles.some((role) => user?.roles.includes(role)) ?? false
  }

  const hasPermission = (permission: string) => {
    return user?.permissions.includes(permission) ?? false
  }

  const hasAnyPermission = (permissions: string[]) => {
    return (
      permissions.some((permission) =>
        user?.permissions.includes(permission),
      ) ?? false
    )
  }

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (response.ok) {
      const userData = await response.json()
      setUser(userData)
      setIsAuthenticated(true)
    } else {
      throw new Error('Authentication failed')
    }
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        hasRole,
        hasAnyRole,
        hasPermission,
        hasAnyPermission,
        login,
        logout,
      }}
    >
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

### 2. Update Router Context Types

Update `src/routes/__root.tsx`:

```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

interface AuthState {
  isAuthenticated: boolean
  user: {
    id: string
    username: string
    email: string
    roles: string[]
    permissions: string[]
  } | null
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
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
    </div>
  ),
})
```

---

## Create Role-Protected Routes

### 1. Admin-Only Routes

Create `src/routes/_authenticated/_admin.tsx`:

```tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.hasRole('admin')) {
      throw redirect({
        to: '/unauthorized',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div>
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <strong>Admin Area:</strong> You have administrative privileges.
      </div>
      <Outlet />
    </div>
  )
}
```

### 2. Multiple Role Access

Create `src/routes/_authenticated/_moderator.tsx`:

```tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_moderator')({
  beforeLoad: ({ context, location }) => {
    const allowedRoles = ['admin', 'moderator']
    if (!context.auth.hasAnyRole(allowedRoles)) {
      throw redirect({
        to: '/unauthorized',
        search: {
          redirect: location.href,
          reason: 'insufficient_role',
        },
      })
    }
  },
  component: ModeratorLayout,
})

function ModeratorLayout() {
  const { auth } = Route.useRouteContext()

  return (
    <div>
      <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
        <strong>Moderator Area:</strong> Role: {auth.user?.roles.join(', ')}
      </div>
      <Outlet />
    </div>
  )
}
```

### 3. Permission-Based Routes

Create `src/routes/_authenticated/_users.tsx`:

```tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_users')({
  beforeLoad: ({ context, location }) => {
    const requiredPermissions = ['users:read', 'users:write']
    if (!context.auth.hasAnyPermission(requiredPermissions)) {
      throw redirect({
        to: '/unauthorized',
        search: {
          redirect: location.href,
          reason: 'insufficient_permissions',
        },
      })
    }
  },
  component: () => <Outlet />,
})
```

---

## Create Specific Protected Pages

### 1. Admin Dashboard

Create `src/routes/_authenticated/_admin/dashboard.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_admin/dashboard')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const { auth } = Route.useRouteContext()

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">User Management</h2>
          <p className="text-gray-600">Manage all users in the system</p>
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            View Users
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">System Settings</h2>
          <p className="text-gray-600">Configure system-wide settings</p>
          <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Open Settings
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Reports</h2>
          <p className="text-gray-600">View system reports and analytics</p>
          <button className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
            View Reports
          </button>
        </div>
      </div>

      <div className="mt-8 bg-gray-100 p-4 rounded">
        <h3 className="font-semibold">Your Info:</h3>
        <p>Username: {auth.user?.username}</p>
        <p>Roles: {auth.user?.roles.join(', ')}</p>
        <p>Permissions: {auth.user?.permissions.join(', ')}</p>
      </div>
    </div>
  )
}
```

### 2. User Management Page

Create `src/routes/_authenticated/_users/manage.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_users/manage')({
  beforeLoad: ({ context }) => {
    // Additional permission check at the page level
    if (!context.auth.hasPermission('users:write')) {
      throw new Error('You need write permissions to manage users')
    }
  },
  component: UserManagement,
})

function UserManagement() {
  const { auth } = Route.useRouteContext()

  const canEdit = auth.hasPermission('users:write')
  const canDelete = auth.hasPermission('users:delete')

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">John Doe</td>
              <td className="px-6 py-4 whitespace-nowrap">john@example.com</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  User
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {canEdit && (
                  <button className="text-blue-600 hover:text-blue-900 mr-4">
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold text-blue-800">Your Permissions:</h3>
        <ul className="text-blue-700 text-sm">
          {auth.user?.permissions.map((permission) => (
            <li key={permission}>✓ {permission}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

---

## Create Unauthorized Page

Create `src/routes/unauthorized.tsx`:

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/unauthorized')({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || '/dashboard',
    reason: (search.reason as string) || 'insufficient_permissions',
  }),
  component: UnauthorizedPage,
})

function UnauthorizedPage() {
  const { redirect, reason } = Route.useSearch()
  const { auth } = Route.useRouteContext()

  const reasonMessages = {
    insufficient_role: 'You do not have the required role to access this page.',
    insufficient_permissions:
      'You do not have the required permissions to access this page.',
    default: 'You are not authorized to access this page.',
  }

  const message =
    reasonMessages[reason as keyof typeof reasonMessages] ||
    reasonMessages.default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="mb-6 text-sm text-gray-500">
          <p>
            <strong>Your roles:</strong> {auth.user?.roles.join(', ') || 'None'}
          </p>
          <p>
            <strong>Your permissions:</strong>{' '}
            {auth.user?.permissions.join(', ') || 'None'}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            to="/dashboard"
            className="block w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>

          <Link
            to={redirect}
            className="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  )
}
```

---

## Component-Level Permission Checks

### 1. Conditional Rendering Hook

Create `src/hooks/usePermissions.ts`:

```tsx
import { useRouter } from '@tanstack/react-router'

export function usePermissions() {
  const router = useRouter()
  const auth = router.options.context.auth

  return {
    hasRole: auth.hasRole,
    hasAnyRole: auth.hasAnyRole,
    hasPermission: auth.hasPermission,
    hasAnyPermission: auth.hasAnyPermission,
    user: auth.user,
  }
}
```

### 2. Permission Guard Component

Create `src/components/PermissionGuard.tsx`:

```tsx
interface PermissionGuardProps {
  children: React.ReactNode
  roles?: string[]
  permissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode
}

export function PermissionGuard({
  children,
  roles = [],
  permissions = [],
  requireAll = false,
  fallback = null,
}: PermissionGuardProps) {
  const { hasAnyRole, hasAnyPermission, hasRole, hasPermission } =
    usePermissions()

  const hasRequiredRoles =
    roles.length === 0 ||
    (requireAll ? roles.every((role) => hasRole(role)) : hasAnyRole(roles))

  const hasRequiredPermissions =
    permissions.length === 0 ||
    (requireAll
      ? permissions.every((permission) => hasPermission(permission))
      : hasAnyPermission(permissions))

  if (hasRequiredRoles && hasRequiredPermissions) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
```

### 3. Using Permission Guards

```tsx
import { PermissionGuard } from '../components/PermissionGuard'

function SomeComponent() {
  return (
    <div>
      <h1>Dashboard</h1>

      <PermissionGuard roles={['admin']}>
        <button className="bg-red-600 text-white px-4 py-2 rounded">
          Admin Only Button
        </button>
      </PermissionGuard>

      <PermissionGuard
        permissions={['users:write']}
        fallback={<p className="text-gray-500">You cannot edit users</p>}
      >
        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Edit Users
        </button>
      </PermissionGuard>

      <PermissionGuard
        roles={['admin', 'moderator']}
        permissions={['content:moderate']}
        requireAll={true}
      >
        <button className="bg-yellow-600 text-white px-4 py-2 rounded">
          Moderate Content (Admin/Mod + Permission)
        </button>
      </PermissionGuard>
    </div>
  )
}
```

---

## Advanced Permission Patterns

### 1. Resource-Based Permissions

```tsx
// Check if user can edit a specific resource
function canEditResource(auth: AuthState, resourceId: string, ownerId: string) {
  // Admin can edit anything
  if (auth.hasRole('admin')) return true

  // Owner can edit their own resources
  if (auth.user?.id === ownerId && auth.hasPermission('resource:edit:own'))
    return true

  // Moderators can edit with permission
  if (auth.hasRole('moderator') && auth.hasPermission('resource:edit:any'))
    return true

  return false
}

// Usage in component
function ResourceEditor({ resource }) {
  const { auth } = Route.useRouteContext()

  if (!canEditResource(auth, resource.id, resource.ownerId)) {
    return <div>You cannot edit this resource</div>
  }

  return <EditForm resource={resource} />
}
```

### 2. Time-Based Permissions

```tsx
function hasTimeBasedPermission(auth: AuthState, permission: string) {
  const userPermissions = auth.user?.permissions || []
  const hasPermission = userPermissions.includes(permission)

  // Check if permission has time restrictions
  const timeRestricted = userPermissions.find((p) =>
    p.startsWith(`${permission}:time:`),
  )

  if (timeRestricted) {
    const [, , startHour, endHour] = timeRestricted.split(':')
    const currentHour = new Date().getHours()
    return (
      currentHour >= parseInt(startHour) && currentHour <= parseInt(endHour)
    )
  }

  return hasPermission
}
```

---

## Common Problems

### Role/Permission Data Not Loading

**Problem:** User roles/permissions are undefined in routes.

**Solution:** Ensure your authentication API returns complete user data:

```tsx
const login = async (username: string, password: string) => {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (response.ok) {
    const userData = await response.json()
    // Ensure userData includes roles and permissions
    console.log('User data:', userData) // Debug log
    setUser(userData)
    setIsAuthenticated(true)
  }
}
```

### Permission Checks Too Restrictive

**Problem:** Users locked out of areas they should access.

**Solution:** Use hierarchical permissions and role inheritance:

```tsx
const roleHierarchy = {
  admin: ['admin', 'moderator', 'user'],
  moderator: ['moderator', 'user'],
  user: ['user'],
}

const hasRole = (requiredRole: string) => {
  const userRoles = user?.roles || []
  return userRoles.some((userRole) =>
    roleHierarchy[userRole]?.includes(requiredRole),
  )
}
```

### Performance Issues with Many Permission Checks

**Problem:** Too many permission checks slowing down renders.

**Solution:** Memoize permission computations:

```tsx
import { useMemo } from 'react'

function usePermissions() {
  const { auth } = Route.useRouteContext()

  const permissions = useMemo(
    () => ({
      canEditUsers: auth.hasPermission('users:write'),
      canDeleteUsers: auth.hasPermission('users:delete'),
      isAdmin: auth.hasRole('admin'),
      isModerator: auth.hasAnyRole(['admin', 'moderator']),
    }),
    [auth.user?.roles, auth.user?.permissions],
  )

  return permissions
}
```

---

## Common Next Steps

After setting up RBAC, you might want to:

- [How to Set Up Basic Authentication](./setup-authentication.md) - Core auth implementation
- [How to Integrate Authentication Providers](./setup-auth-providers.md) - Use external auth services

<!-- TODO: Uncomment as how-to guides are created
- [How to Implement Dynamic Permissions](./setup-dynamic-permissions.md)
- [How to Audit User Actions](./setup-audit-logging.md)
-->

## Related Resources

- [Authenticated Routes Guide](../guide/authenticated-routes.md) - Core authentication concepts
- [Router Context Guide](../guide/router-context.md) - Understanding router context
- [RBAC Best Practices](https://auth0.com/docs/manage-users/access-control/rbac) - General RBAC principles
