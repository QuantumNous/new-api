---
title: How to Test Router with File-Based Routing
---

This guide covers testing TanStack Router applications that use file-based routing, including testing route generation, file-based route components, and file-based routing patterns.

## Quick Start

Test file-based routing by setting up route mocking utilities, testing generated route trees, and implementing patterns specific to file-based route structures and conventions.

---

## Understanding File-Based Routing Testing

File-based routing testing differs from code-based routing testing in several key ways:

- **Generated Route Trees**: Routes are automatically generated from filesystem structure
- **File Conventions**: Routes follow specific file naming conventions (`index.tsx`, `route.tsx`, `$param.tsx`)
- **Route Discovery**: Routes are discovered through filesystem scanning rather than explicit imports
- **Type Generation**: Route types are automatically generated and need special testing considerations

---

## Setting Up File-Based Route Testing

### 1. Install Test Dependencies

For file-based routing testing, you'll need the same base dependencies as regular router testing:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### 2. Configure Test Environment

Create `vitest.config.ts` with file-based routing support:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      // Configure for test environment
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      disableLogging: true,
    }),
    react(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    typecheck: { enabled: true },
    watch: false,
    // Ensure route tree is generated before tests
    globals: true,
  },
})
```

### 3. Create Route Testing Utilities

Create `src/test/file-route-utils.tsx`:

```tsx
import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import {
  createRouter,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from '../routeTree.gen'

// Create test router with generated route tree
export function createTestRouterFromFiles(initialLocation = '/') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialLocation],
    }),
    context: {
      // Add any required context for your routes
    },
  })

  return router
}

// Custom render function for file-based routes
interface RenderWithFileRoutesOptions extends Omit<RenderOptions, 'wrapper'> {
  initialLocation?: string
  routerContext?: any
}

export function renderWithFileRoutes(
  ui: React.ReactElement,
  {
    initialLocation = '/',
    routerContext = {},
    ...renderOptions
  }: RenderWithFileRoutesOptions = {},
) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialLocation],
    }),
    context: routerContext,
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <RouterProvider router={router}>{children}</RouterProvider>
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    router,
  }
}

// Helper to test specific file routes
export function createMockFileRoute(
  path: string,
  component: React.ComponentType,
) {
  // This is useful for isolated testing when you don't want to use the full route tree
  return {
    path,
    component,
    // Add other common route properties as needed
  }
}
```

---

## Testing File-Based Route Structure

### 1. Test Route Tree Generation

```tsx
import { describe, it, expect } from 'vitest'
import { routeTree } from '../routeTree.gen'

describe('Generated Route Tree', () => {
  it('should generate route tree from file structure', () => {
    // Test that route tree exists and has expected structure
    expect(routeTree).toBeDefined()
    expect(routeTree.children).toBeDefined()
  })

  it('should include all expected routes', () => {
    // Get all route paths from the generated tree
    const getAllRoutePaths = (tree: any, paths: string[] = []): string[] => {
      if (tree.path) {
        paths.push(tree.path)
      }
      if (tree.children) {
        tree.children.forEach((child: any) => {
          getAllRoutePaths(child, paths)
        })
      }
      return paths
    }

    const routePaths = getAllRoutePaths(routeTree)

    // Test that expected routes are present
    expect(routePaths).toContain('/')
    expect(routePaths).toContain('/about')
    // Add assertions for your specific routes
  })

  it('should have correct route hierarchy', () => {
    // Test parent-child relationships
    const homeRoute = routeTree.children?.find(
      (child: any) => child.path === '/',
    )
    expect(homeRoute).toBeDefined()

    // Test for specific route structure based on your file organization
    // For example, if you have /posts/$postId routes:
    // const postsRoute = routeTree.children?.find((child: any) => child.path === '/posts')
    // expect(postsRoute?.children).toBeDefined()
  })
})
```

### 2. Test File Route Conventions

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('File Route Conventions', () => {
  it('should render index route at root path', () => {
    renderWithFileRoutes(<div />, {
      initialLocation: '/',
    })

    // Test that the index route component renders
    // This depends on what your src/routes/index.tsx exports
    expect(screen.getByText('Welcome Home!')).toBeInTheDocument()
  })

  it('should handle route parameters from filename', () => {
    // If you have a route like src/routes/posts/$postId.tsx
    renderWithFileRoutes(<div />, {
      initialLocation: '/posts/123',
    })

    // Test that parameter is correctly parsed from file-based route
    expect(screen.getByText(/Post.*123/)).toBeInTheDocument()
  })

  it('should handle nested routes from directory structure', () => {
    // If you have src/routes/dashboard/settings.tsx
    renderWithFileRoutes(<div />, {
      initialLocation: '/dashboard/settings',
    })

    expect(screen.getByText(/Settings/)).toBeInTheDocument()
  })

  it('should handle layout routes', () => {
    // If you have src/routes/_layout.tsx
    renderWithFileRoutes(<div />, {
      initialLocation: '/some-nested-route',
    })

    // Test that layout is rendered for nested routes
    expect(screen.getByTestId('layout-header')).toBeInTheDocument()
  })
})
```

---

## Testing File-Based Route Components

### 1. Test Individual Route Files

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { createFileRoute } from '@tanstack/react-router'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('Individual Route Components', () => {
  it('should test about route component', () => {
    renderWithFileRoutes(<div />, {
      initialLocation: '/about',
    })

    expect(screen.getByText('About')).toBeInTheDocument()
  })

  it('should test route with loader data', () => {
    // For a route like src/routes/posts/index.tsx with loader
    renderWithFileRoutes(<div />, {
      initialLocation: '/posts',
    })

    // Wait for loader data to load
    expect(screen.getByText(/Posts List/)).toBeInTheDocument()
  })

  it('should test route with search params validation', () => {
    // For a route with validateSearch in src/routes/search.tsx
    renderWithFileRoutes(<div />, {
      initialLocation: '/search?q=react&page=1',
    })

    expect(screen.getByDisplayValue('react')).toBeInTheDocument()
  })
})
```

### 2. Test Route-Specific Hooks

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('Route-Specific Hooks', () => {
  it('should test useParams in parameterized route', () => {
    // Create a test component that uses Route.useParams()
    function TestComponent() {
      // This would be available in the actual route component
      const params = Route.useParams()
      return <div data-testid="param-value">{params.postId}</div>
    }

    renderWithFileRoutes(<TestComponent />, {
      initialLocation: '/posts/abc123',
    })

    expect(screen.getByTestId('param-value')).toHaveTextContent('abc123')
  })

  it('should test useLoaderData in route with loader', () => {
    renderWithFileRoutes(<div />, {
      initialLocation: '/posts/123',
    })

    // Test that loader data is available in the component
    expect(screen.getByText(/Post Title/)).toBeInTheDocument()
  })

  it('should test useSearch in route with search validation', () => {
    renderWithFileRoutes(<div />, {
      initialLocation: '/search?q=typescript&sort=date',
    })

    // Test that search params are correctly parsed
    expect(screen.getByDisplayValue('typescript')).toBeInTheDocument()
    expect(screen.getByText(/sorted by date/)).toBeInTheDocument()
  })
})
```

---

## Testing Route Navigation with File-Based Routes

### 1. Test Link Navigation

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('File-Based Route Navigation', () => {
  it('should navigate between file-based routes', async () => {
    const user = userEvent.setup()

    const { router } = renderWithFileRoutes(<div />, {
      initialLocation: '/',
    })

    // Initial state - should be on home route
    expect(screen.getByText('Welcome Home!')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')

    // Click navigation link
    await user.click(screen.getByRole('link', { name: /about/i }))

    // Should navigate to about route
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/about')
  })

  it('should handle dynamic route navigation', async () => {
    const user = userEvent.setup()

    renderWithFileRoutes(<div />, {
      initialLocation: '/posts',
    })

    // Click on a post link (assuming your posts route renders links)
    await user.click(screen.getByRole('link', { name: /View Post 1/i }))

    // Should navigate to dynamic post route
    expect(screen.getByText(/Post 1 Details/)).toBeInTheDocument()
  })

  it('should handle nested route navigation', async () => {
    const user = userEvent.setup()

    renderWithFileRoutes(<div />, {
      initialLocation: '/dashboard',
    })

    // Navigate to nested route
    await user.click(screen.getByRole('link', { name: /settings/i }))

    expect(screen.getByText(/Dashboard Settings/)).toBeInTheDocument()
  })
})
```

### 2. Test Programmatic Navigation

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('Programmatic Navigation', () => {
  it('should programmatically navigate between file routes', async () => {
    const user = userEvent.setup()

    const { router } = renderWithFileRoutes(<div />, {
      initialLocation: '/',
    })

    // Trigger programmatic navigation (button in your component)
    await user.click(screen.getByRole('button', { name: /Go to Posts/i }))

    expect(router.state.location.pathname).toBe('/posts')
  })

  it('should navigate with search params', async () => {
    const user = userEvent.setup()

    const { router } = renderWithFileRoutes(<div />, {
      initialLocation: '/search',
    })

    // Trigger search with params
    await user.type(screen.getByRole('textbox'), 'test query')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(router.state.location.search).toMatchObject({
      q: 'test query',
    })
  })
})
```

---

## Testing File-Based Route Guards and Loaders

### 1. Test Route Guards

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('File-Based Route Guards', () => {
  it('should redirect unauthenticated users from protected routes', () => {
    // Mock unauthenticated state
    const mockAuth = { isAuthenticated: false, user: null }

    renderWithFileRoutes(<div />, {
      initialLocation: '/dashboard',
      routerContext: { auth: mockAuth },
    })

    // Should redirect to login (based on your beforeLoad implementation)
    expect(screen.getByText(/Please log in/)).toBeInTheDocument()
  })

  it('should allow authenticated users to access protected routes', () => {
    const mockAuth = {
      isAuthenticated: true,
      user: { id: '1', name: 'John' },
    }

    renderWithFileRoutes(<div />, {
      initialLocation: '/dashboard',
      routerContext: { auth: mockAuth },
    })

    expect(screen.getByText(/Welcome to Dashboard/)).toBeInTheDocument()
  })
})
```

### 2. Test Route Loaders

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('File-Based Route Loaders', () => {
  it('should load data for route with loader', async () => {
    // Mock the API function used in your route loader
    const mockFetchPost = vi.fn().mockResolvedValue({
      id: '123',
      title: 'Test Post',
      content: 'Test content',
    })

    // If your route loader uses a global API function, mock it
    vi.mock('../api/posts', () => ({
      fetchPost: mockFetchPost,
    }))

    renderWithFileRoutes(<div />, {
      initialLocation: '/posts/123',
    })

    await waitFor(() => {
      expect(screen.getByText('Test Post')).toBeInTheDocument()
    })

    expect(mockFetchPost).toHaveBeenCalledWith('123')
  })

  it('should handle loader errors', async () => {
    const mockFetchPost = vi.fn().mockRejectedValue(new Error('Post not found'))

    vi.mock('../api/posts', () => ({
      fetchPost: mockFetchPost,
    }))

    renderWithFileRoutes(<div />, {
      initialLocation: '/posts/invalid',
    })

    await waitFor(() => {
      expect(screen.getByText(/Error.*Post not found/)).toBeInTheDocument()
    })
  })
})
```

---

## Testing File Route Validation

### 1. Test Search Parameter Validation

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('File Route Validation', () => {
  it('should validate search parameters', () => {
    // Test with valid search params
    renderWithFileRoutes(<div />, {
      initialLocation: '/search?q=react&page=1&sort=date',
    })

    expect(screen.getByDisplayValue('react')).toBeInTheDocument()
    expect(screen.getByText(/Page 1/)).toBeInTheDocument()
  })

  it('should handle invalid search parameters', () => {
    // Test with invalid search params (e.g., invalid page number)
    renderWithFileRoutes(<div />, {
      initialLocation: '/search?page=invalid&sort=unknown',
    })

    // Should fall back to defaults based on your validation schema
    expect(screen.getByText(/Page 1/)).toBeInTheDocument() // default page
  })

  it('should validate route parameters', () => {
    // Test with valid route param
    renderWithFileRoutes(<div />, {
      initialLocation: '/posts/123',
    })

    expect(screen.getByText(/Post 123/)).toBeInTheDocument()
  })
})
```

---

## Testing File Route Error Boundaries

### 1. Test Route-Level Error Handling

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('File Route Error Handling', () => {
  it('should handle component errors with error boundary', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Force an error in a route component
    vi.mock('../routes/error-prone.tsx', () => ({
      Route: {
        component: () => {
          throw new Error('Test error')
        },
      },
    }))

    renderWithFileRoutes(<div />, {
      initialLocation: '/error-prone',
    })

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('should handle loader errors with error component', async () => {
    const mockFailingLoader = vi
      .fn()
      .mockRejectedValue(new Error('Load failed'))

    vi.mock('../api/data', () => ({
      loadData: mockFailingLoader,
    }))

    renderWithFileRoutes(<div />, {
      initialLocation: '/data-route',
    })

    expect(screen.getByText(/Failed to load data/)).toBeInTheDocument()
  })
})
```

---

## Testing with Generated Route Types

### 1. Test Type Safety

```tsx
import { describe, it, expect } from 'vitest'
import { useNavigate } from '@tanstack/react-router'
import { renderWithFileRoutes } from '../test/file-route-utils'

describe('Generated Route Types', () => {
  it('should provide type-safe navigation', () => {
    function TestComponent() {
      const navigate = useNavigate()

      const handleNavigate = () => {
        // This should be type-safe based on your generated routes
        navigate({
          to: '/posts/$postId',
          params: { postId: '123' },
          search: { tab: 'comments' },
        })
      }

      return (
        <button onClick={handleNavigate} data-testid="navigate-btn">
          Navigate
        </button>
      )
    }

    const { router } = renderWithFileRoutes(<TestComponent />, {
      initialLocation: '/',
    })

    // Test the navigation works correctly
    const button = screen.getByTestId('navigate-btn')
    fireEvent.click(button)

    expect(router.state.location.pathname).toBe('/posts/123')
    expect(router.state.location.search).toEqual({ tab: 'comments' })
  })
})
```

---

## Testing Route Tree Changes

### 1. Test Route Generation During Development

```tsx
import { describe, it, expect } from 'vitest'
import { routeTree } from '../routeTree.gen'

describe('Route Tree Development', () => {
  it('should regenerate routes when files change', () => {
    // This test ensures your route tree is properly generated
    // You can add specific assertions based on your file structure

    expect(routeTree).toBeDefined()
    expect(typeof routeTree.children).toBe('object')

    // Test specific routes exist
    const routes = getAllRouteIds(routeTree)
    expect(routes).toContain('/')
    expect(routes).toContain('/about')
    // Add assertions for your specific routes
  })

  // Helper function to get all route IDs from tree
  function getAllRouteIds(tree: any, ids: string[] = []): string[] {
    if (tree.id) {
      ids.push(tree.id)
    }
    if (tree.children) {
      Object.values(tree.children).forEach((child: any) => {
        getAllRouteIds(child, ids)
      })
    }
    return ids
  }
})
```

---

## E2E Testing for File-Based Routes

### 1. Playwright Configuration for File-Based Routes

Create `e2e/file-routing.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('File-Based Route E2E', () => {
  test('should navigate through file-based route structure', async ({
    page,
  }) => {
    await page.goto('/')

    // Test home route (from src/routes/index.tsx)
    await expect(page.locator('h3')).toContainText('Welcome Home!')

    // Navigate to about route (from src/routes/about.tsx)
    await page.click('text=About')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('h3')).toContainText('About')

    // Test browser navigation
    await page.goBack()
    await expect(page).toHaveURL('/')
  })

  test('should handle dynamic routes from file structure', async ({ page }) => {
    await page.goto('/posts')

    // Click on a dynamic post link (from src/routes/posts/$postId.tsx)
    await page.click('[data-testid="post-link-1"]')
    await expect(page).toHaveURL('/posts/1')
    await expect(page.locator('h1')).toContainText('Post 1')
  })

  test('should handle nested routes', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to nested route (from src/routes/dashboard/settings.tsx)
    await page.click('text=Settings')
    await expect(page).toHaveURL('/dashboard/settings')
    await expect(page.locator('h2')).toContainText('Settings')
  })
})
```

---

## Common File-Based Routing Testing Patterns

### 1. Mock Route Files for Testing

```tsx
// src/test/mock-file-routes.tsx
import { createFileRoute } from '@tanstack/react-router'

// Mock individual route for isolated testing
export const createMockFileRoute = (
  path: string,
  component: React.ComponentType,
  options: any = {},
) => {
  return createFileRoute(path)({
    component,
    ...options,
  })
}

// Common test route components
export const TestHomeRoute = createMockFileRoute('/', () => (
  <div data-testid="home">Home Page</div>
))

export const TestAboutRoute = createMockFileRoute('/about', () => (
  <div data-testid="about">About Page</div>
))

export const TestDynamicRoute = createMockFileRoute('/posts/$postId', () => {
  const { postId } = Route.useParams()
  return <div data-testid="post">Post {postId}</div>
})
```

### 2. Test Route Discovery

```tsx
import { describe, it, expect } from 'vitest'

describe('Route Discovery', () => {
  it('should discover all routes from file structure', () => {
    // Test that your route tree includes all expected routes
    // This helps catch when routes are accidentally not being generated

    const expectedRoutes = [
      '/',
      '/about',
      '/posts',
      '/posts/$postId',
      '/dashboard',
      '/dashboard/settings',
    ]

    expectedRoutes.forEach((routePath) => {
      const routeExists = checkRouteExists(routeTree, routePath)
      expect(routeExists).toBe(true)
    })
  })
})

function checkRouteExists(tree: any, path: string): boolean {
  // Implementation to check if route exists in tree
  // This depends on your route tree structure
  return true // Simplified
}
```

---

## Best Practices for File-Based Route Testing

### 1. Test Organization

```
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   ├── about.tsx
│   ├── posts/
│   │   ├── index.tsx
│   │   └── $postId.tsx
├── test/
│   ├── setup.ts
│   ├── file-route-utils.tsx
│   └── routes/
│       ├── index.test.tsx
│       ├── about.test.tsx
│       └── posts/
│           ├── index.test.tsx
│           └── $postId.test.tsx
```

### 2. Common Test Patterns

```tsx
// Test file for each route file
describe('Posts Route (/posts)', () => {
  it('should render posts list', () => {
    renderWithFileRoutes(<div />, {
      initialLocation: '/posts',
    })

    expect(screen.getByText(/Posts/)).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    // Test pending state for route with loader
  })

  it('should handle error state', () => {
    // Test error handling for route
  })
})

// Test route groups
describe('Dashboard Routes', () => {
  describe('/dashboard', () => {
    // Dashboard index tests
  })

  describe('/dashboard/settings', () => {
    // Settings route tests
  })
})
```

---

## Troubleshooting File-Based Route Testing

### Common Issues

**Problem**: Route tree not found in tests

```bash
Error: Cannot find module '../routeTree.gen'
```

**Solution**: Ensure route tree generation in test setup:

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [
    tanstackRouter(), // Ensure this runs before tests
    react(),
  ],
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

**Problem**: Routes not updating in tests after file changes

**Solution**: Clear module cache in test setup:

```ts
// src/test/setup.ts
beforeEach(() => {
  vi.clearAllMocks()
  // Clear route tree cache if needed
  delete require.cache[require.resolve('../routeTree.gen')]
})
```

**Problem**: Type errors in tests with generated routes

**Solution**: Ensure proper TypeScript configuration:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*", "src/routeTree.gen.ts"]
}
```

---

## Next Steps

After setting up file-based route testing, you might want to:

- [How to Set Up Testing with Code-Based Routing](./setup-testing.md) - Testing patterns for manually defined routes
- [How to Debug Router Issues](./debug-router-issues.md) - Debug file-based routing issues
- [File-Based Routing Guide](../routing/file-based-routing.md) - Learn more about file-based routing

## Related Resources

- [TanStack Router File-Based Routing](../routing/file-based-routing.md) - Complete file-based routing guide
- [File Naming Conventions](../routing/file-naming-conventions.md) - Understanding file structure
- [Testing Library](https://testing-library.com/) - Component testing utilities
- [Vitest](https://vitest.dev/) - Testing framework documentation
