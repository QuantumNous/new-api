# How to Set Up Testing with Code-Based Routing

This guide covers setting up comprehensive testing for TanStack Router applications that use code-based routing, including unit tests, integration tests, and end-to-end testing strategies.

## Quick Start

Set up testing by configuring your test framework (Vitest/Jest), creating router test utilities, and implementing patterns for testing navigation, route components, and data loading with manually defined routes.

> **Using File-Based Routing?** See [How to Test File-Based Routing](./test-file-based-routing.md) for patterns specific to file-based routing applications.

---

## Configure Test Framework

### 1. Install Dependencies

For **Vitest** (recommended):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

For **Jest**:

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

### 2. Configure Vitest

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    typecheck: { enabled: true },
    watch: false,
  },
})
```

### 3. Create Test Setup

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'

// @ts-expect-error
global.IS_REACT_ACT_ENVIRONMENT = true
```

---

## Code-Based Router Testing Patterns

The following patterns are specifically designed for applications using code-based routing where you manually create routes with `createRoute()` and build route trees programmatically.

### 1. TanStack Router Internal Pattern (Recommended)

The TanStack Router team uses this pattern internally for testing router components:

```tsx
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'

let history: RouterHistory

beforeEach(() => {
  history = createBrowserHistory()
  expect(window.location.pathname).toBe('/')
})

afterEach(() => {
  history.destroy()
  window.history.replaceState(null, 'root', '/')
  vi.clearAllMocks()
  vi.resetAllMocks()
  cleanup()
})

describe('Router Component Testing', () => {
  test('should render route component', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <h1>IndexTitle</h1>,
    })

    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('IndexTitle')).toBeInTheDocument()
  })
})
```

### 2. Alternative: Router Test Utilities (For Simpler Cases)

Create `src/test/router-utils.tsx`:

```tsx
import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import {
  createRouter,
  createRootRoute,
  createRoute,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import { createMemoryHistory } from '@tanstack/react-router'

// Create a root route for testing
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Test router factory
export function createTestRouter(routes: any[], initialLocation = '/') {
  const routeTree = rootRoute.addChildren(routes)

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialLocation],
    }),
  })

  return router
}

// Wrapper component for testing
interface RouterWrapperProps {
  children: React.ReactNode
  router: any
}

function RouterWrapper({ children, router }: RouterWrapperProps) {
  return <RouterProvider router={router}>{children}</RouterProvider>
}

// Custom render function with router
interface RenderWithRouterOptions extends Omit<RenderOptions, 'wrapper'> {
  router?: any
  initialLocation?: string
  routes?: any[]
}

export function renderWithRouter(
  ui: React.ReactElement,
  {
    router,
    initialLocation = '/',
    routes = [],
    ...renderOptions
  }: RenderWithRouterOptions = {},
) {
  if (!router && routes.length > 0) {
    router = createTestRouter(routes, initialLocation)
  }

  if (!router) {
    throw new Error(
      'Router is required. Provide either a router or routes array.',
    )
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <RouterWrapper router={router}>{children}</RouterWrapper>
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    router,
  }
}
```

### 2. Mock Route Factory

Create `src/test/mock-routes.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './router-utils'

export const createMockRoute = (
  path: string,
  component: React.ComponentType,
  options: any = {},
) => {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component,
    ...options,
  })
}

// Common test components
export function TestComponent({ title = 'Test' }: { title?: string }) {
  return <div data-testid="test-component">{title}</div>
}

export function LoadingComponent() {
  return <div data-testid="loading">Loading...</div>
}

export function ErrorComponent({ error }: { error: Error }) {
  return <div data-testid="error">Error: {error.message}</div>
}
```

---

## Test Code-Based Route Components

### 1. Basic Component Testing

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { createRoute } from '@tanstack/react-router'
import {
  renderWithRouter,
  rootRoute,
  TestComponent,
} from '../test/router-utils'

describe('Code-Based Route Component Testing', () => {
  it('should render route component', () => {
    const testRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: TestComponent,
    })

    renderWithRouter(<div />, {
      routes: [testRoute],
      initialLocation: '/',
    })

    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  it('should render component with props from route context', () => {
    function ComponentWithContext() {
      const { title } = Route.useLoaderData()
      return <div data-testid="context-component">{title}</div>
    }

    const contextRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/context',
      component: ComponentWithContext,
      loader: () => ({ title: 'From Context' }),
    })

    renderWithRouter(<div />, {
      routes: [contextRoute],
      initialLocation: '/context',
    })

    expect(screen.getByText('From Context')).toBeInTheDocument()
  })
})
```

### 2. Testing Route Parameters

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { createRoute } from '@tanstack/react-router'
import { renderWithRouter, rootRoute } from '../test/router-utils'

describe('Route Parameters', () => {
  it('should handle route params correctly', () => {
    function UserProfile() {
      const { userId } = Route.useParams()
      return <div data-testid="user-profile">User: {userId}</div>
    }

    const userRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      component: UserProfile,
    })

    renderWithRouter(<div />, {
      routes: [userRoute],
      initialLocation: '/users/123',
    })

    expect(screen.getByText('User: 123')).toBeInTheDocument()
  })

  it('should handle search params correctly', () => {
    function SearchPage() {
      const { q, page } = Route.useSearch()
      return (
        <div data-testid="search-results">
          Query: {q}, Page: {page}
        </div>
      )
    }

    const searchRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/search',
      component: SearchPage,
      validateSearch: (search) => ({
        q: (search.q as string) || '',
        page: Number(search.page) || 1,
      }),
    })

    renderWithRouter(<div />, {
      routes: [searchRoute],
      initialLocation: '/search?q=react&page=2',
    })

    expect(screen.getByText('Query: react, Page: 2')).toBeInTheDocument()
  })
})
```

---

## Test Navigation

### 1. Testing Link Components

```tsx
import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, createRoute } from '@tanstack/react-router'
import {
  renderWithRouter,
  rootRoute,
  TestComponent,
} from '../test/router-utils'

describe('Code-Based Route Navigation', () => {
  it('should navigate when link is clicked', async () => {
    const user = userEvent.setup()

    function HomePage() {
      return (
        <div>
          <h1>Home</h1>
          <Link to="/about" data-testid="about-link">
            About
          </Link>
        </div>
      )
    }

    function AboutPage() {
      return <h1>About Page</h1>
    }

    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: HomePage,
    })

    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: AboutPage,
    })

    const { router } = renderWithRouter(<div />, {
      routes: [homeRoute, aboutRoute],
      initialLocation: '/',
    })

    // Initial state
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')

    // Click link
    await user.click(screen.getByTestId('about-link'))

    // Check navigation
    expect(screen.getByText('About Page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/about')
  })

  it('should navigate programmatically', async () => {
    function NavigationTest() {
      const navigate = Route.useNavigate()

      const handleNavigate = () => {
        navigate({ to: '/dashboard', search: { tab: 'settings' } })
      }

      return (
        <div>
          <h1>Navigation Test</h1>
          <button onClick={handleNavigate} data-testid="navigate-btn">
            Go to Dashboard
          </button>
        </div>
      )
    }

    const testRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: NavigationTest,
    })

    const dashboardRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/dashboard',
      component: () => <h1>Dashboard</h1>,
      validateSearch: (search) => ({
        tab: (search.tab as string) || 'general',
      }),
    })

    const { router } = renderWithRouter(<div />, {
      routes: [testRoute, dashboardRoute],
      initialLocation: '/',
    })

    await userEvent.click(screen.getByTestId('navigate-btn'))

    expect(router.state.location.pathname).toBe('/dashboard')
    expect(router.state.location.search).toEqual({ tab: 'settings' })
  })
})
```

### 2. Testing Route Guards

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { createRoute, redirect } from '@tanstack/react-router'
import { renderWithRouter, rootRoute } from '../test/router-utils'

describe('Code-Based Route Guards', () => {
  it('should redirect unauthenticated users', () => {
    const mockAuth = { isAuthenticated: false }

    function ProtectedPage() {
      return <h1>Protected Content</h1>
    }

    function LoginPage() {
      return <h1>Login Required</h1>
    }

    const protectedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/protected',
      component: ProtectedPage,
      beforeLoad: ({ context }) => {
        if (!mockAuth.isAuthenticated) {
          throw redirect({ to: '/login' })
        }
      },
    })

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
      component: LoginPage,
    })

    renderWithRouter(<div />, {
      routes: [protectedRoute, loginRoute],
      initialLocation: '/protected',
    })

    // Should redirect to login
    expect(screen.getByText('Login Required')).toBeInTheDocument()
  })

  it('should allow authenticated users', () => {
    const mockAuth = { isAuthenticated: true }

    function ProtectedPage() {
      return <h1>Protected Content</h1>
    }

    const protectedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/protected',
      component: ProtectedPage,
      beforeLoad: ({ context }) => {
        if (!mockAuth.isAuthenticated) {
          throw redirect({ to: '/login' })
        }
      },
    })

    renderWithRouter(<div />, {
      routes: [protectedRoute],
      initialLocation: '/protected',
    })

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
```

---

## Test Data Loading

### 1. Testing Loaders

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { createRoute } from '@tanstack/react-router'
import { renderWithRouter, rootRoute } from '../test/router-utils'

describe('Code-Based Route Data Loading', () => {
  it('should load and display data from loader', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue({
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
    })

    function UserProfile() {
      const user = Route.useLoaderData()
      return (
        <div data-testid="user-profile">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
      )
    }

    const userRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      component: UserProfile,
      loader: ({ params }) => mockFetchUser(params.userId),
    })

    renderWithRouter(<div />, {
      routes: [userRoute],
      initialLocation: '/users/1',
    })

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })

    expect(mockFetchUser).toHaveBeenCalledWith('1')
  })

  it('should handle loader errors', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('User not found'))

    function UserProfile() {
      const user = Route.useLoaderData()
      return <div>{user.name}</div>
    }

    function ErrorComponent({ error }: { error: Error }) {
      return <div data-testid="error">Error: {error.message}</div>
    }

    const userRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      component: UserProfile,
      loader: ({ params }) => mockFetchUser(params.userId),
      errorComponent: ErrorComponent,
    })

    renderWithRouter(<div />, {
      routes: [userRoute],
      initialLocation: '/users/1',
    })

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument()
      expect(screen.getByText('Error: User not found')).toBeInTheDocument()
    })
  })
})
```

### 2. Testing with React Query

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoute } from '@tanstack/react-router'
import { renderWithRouter, rootRoute } from '../test/router-utils'

describe('React Query Integration', () => {
  it('should work with React Query', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const mockFetchPosts = vi.fn().mockResolvedValue([
      { id: 1, title: 'Post 1' },
      { id: 2, title: 'Post 2' },
    ])

    function PostsList() {
      const posts = Route.useLoaderData()
      return (
        <div data-testid="posts-list">
          {posts.map((post: any) => (
            <div key={post.id}>{post.title}</div>
          ))}
        </div>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: PostsList,
      loader: ({ context: { queryClient } }) =>
        queryClient.ensureQueryData({
          queryKey: ['posts'],
          queryFn: mockFetchPosts,
        }),
    })

    function TestWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }

    renderWithRouter(<div />, {
      routes: [postsRoute],
      initialLocation: '/posts',
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Post 1')).toBeInTheDocument()
      expect(screen.getByText('Post 2')).toBeInTheDocument()
    })
  })
})
```

---

## Test with Context

### 1. Testing Router Context

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
} from '@tanstack/react-router'

interface RouterContext {
  auth: {
    user: { id: string; name: string } | null
    isAuthenticated: boolean
  }
}

describe('Code-Based Router Context', () => {
  it('should provide context to routes', () => {
    const rootRouteWithContext = createRootRouteWithContext<RouterContext>()({
      component: () => <Outlet />,
    })

    function UserDashboard() {
      const { auth } = Route.useRouteContext()
      return (
        <div data-testid="dashboard">
          Welcome, {auth.user?.name || 'Guest'}!
        </div>
      )
    }

    const dashboardRoute = createRoute({
      getParentRoute: () => rootRouteWithContext,
      path: '/dashboard',
      component: UserDashboard,
    })

    const mockContext = {
      auth: {
        user: { id: '1', name: 'John Doe' },
        isAuthenticated: true,
      },
    }

    const router = createRouter({
      routeTree: rootRouteWithContext.addChildren([dashboardRoute]),
      context: mockContext,
      history: createMemoryHistory({
        initialEntries: ['/dashboard'],
      }),
    })

    render(<RouterProvider router={router} />)

    expect(screen.getByText('Welcome, John Doe!')).toBeInTheDocument()
  })
})
```

---

## E2E Testing with Playwright

### 1. Playwright Configuration

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 2. E2E Test Example

Create `e2e/navigation.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('Code-Based Router Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/')

    // Check home page
    await expect(page.locator('h1')).toContainText('Home')

    // Navigate to about page
    await page.click('text=About')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('h1')).toContainText('About')

    // Use browser back button
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('Home')
  })

  test('should handle search parameters', async ({ page }) => {
    await page.goto('/search?q=react')

    await expect(page.locator('[data-testid="search-input"]')).toHaveValue(
      'react',
    )
    await expect(page).toHaveURL('/search?q=react')

    // Update search
    await page.fill('[data-testid="search-input"]', 'vue')
    await page.press('[data-testid="search-input"]', 'Enter')

    await expect(page).toHaveURL('/search?q=vue')
  })

  test('should handle authentication flow', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL('/login')

    // Login
    await page.fill('[data-testid="username"]', 'testuser')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-btn"]')

    // Should redirect back to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })
})
```

---

## Code-Based Routing Testing Best Practices

### 1. Test Organization

```
src/
├── components/
│   ├── Header.tsx
│   └── Header.test.tsx
├── routes/
│   ├── posts.tsx     # Code-based route definitions
│   ├── posts.test.tsx
│   └── index.tsx
├── test/
│   ├── setup.ts
│   ├── router-utils.tsx  # Code-based router utilities
│   └── mock-routes.tsx   # Manual route factories
└── __tests__/
    ├── integration/
    └── e2e/
```

### 2. Common Patterns

```tsx
// Mock external dependencies for code-based routes
vi.mock('../api/users', () => ({
  fetchUser: vi.fn(),
  updateUser: vi.fn(),
}))

// Test utility for common code-based route setups
export function createAuthenticatedRouter(user = mockUser) {
  // Manually create routes for testing
  const protectedRoutes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/dashboard',
      component: DashboardComponent,
    }),
  ]

  return createTestRouter(protectedRoutes, {
    context: {
      auth: { user, isAuthenticated: true },
    },
  })
}

// Group related tests
describe('User Management', () => {
  describe('when authenticated', () => {
    it('should show user dashboard', () => {
      // Test implementation
    })
  })

  describe('when not authenticated', () => {
    it('should redirect to login', () => {
      // Test implementation
    })
  })
})
```

---

## Common Problems

### Test Environment Issues

**Problem:** Tests fail with "window is not defined" errors.

**Solution:** Ensure jsdom environment is configured:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

### Router Context Missing

**Problem:** Components can't access router context in tests.

**Solution:** Use the custom render function with router:

```tsx
// ✅ Correct
renderWithRouter(<Component />, { routes, initialLocation })

// ❌ Wrong
render(<Component />)
```

### Async Data Loading

**Problem:** Tests fail because they don't wait for data loading.

**Solution:** Use proper async testing patterns:

```tsx
await waitFor(() => {
  expect(screen.getByText('Loaded Data')).toBeInTheDocument()
})
```

---

## Common Next Steps

After setting up code-based routing testing, you might want to:

- [How to Test File-Based Routing](./test-file-based-routing.md) - Specific patterns for file-based routing apps
- [How to Set Up Basic Authentication](./setup-authentication.md) - Test authentication flows
- [How to Debug Common Router Issues](./debug-router-issues.md) - Debug test failures

<!-- TODO: Uncomment as guides are created
- [How to Set Up Continuous Integration](./setup-ci.md)
- [How to Optimize Test Performance](./optimize-test-performance.md)
-->

## Related Resources

- [Code-Based Routing Guide](../routing/code-based-routing.md) - Understanding code-based routing
- [Vitest Documentation](https://vitest.dev/) - Testing framework
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/) - Component testing utilities
- [Playwright Documentation](https://playwright.dev/) - E2E testing framework
- [TanStack Router Examples](https://github.com/TanStack/router/tree/main/examples) - Example test setups
