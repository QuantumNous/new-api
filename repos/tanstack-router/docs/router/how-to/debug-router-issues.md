---
title: How to Debug Common Router Issues
---

This guide covers debugging common TanStack Router problems, from route matching failures to navigation issues and performance problems.

## Quick Start

Use TanStack Router DevTools for real-time debugging, add strategic console logging, and follow systematic troubleshooting patterns to identify and resolve router issues quickly.

---

## Essential Debugging Tools

### 1. TanStack Router DevTools

Install and configure the DevTools for the best debugging experience:

```bash
npm install @tanstack/router-devtools
```

```tsx
// src/App.tsx
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

function App() {
  return (
    <div>
      <RouterProvider router={router} />
      {/* Only shows in development */}
      <TanStackRouterDevtools router={router} />
    </div>
  )
}
```

**DevTools Features:**

- **Route Tree Visualization** - See your entire route structure
- **Current Route State** - Inspect active route data, params, and search
- **Navigation History** - Track navigation events and timing
- **Route Matching** - See which routes match current URL
- **Performance Metrics** - Monitor route load times and re-renders

### 2. Debug Mode Configuration

Enable debug mode for detailed console logging:

```tsx
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    // your context
  },
  // Enable debug mode
  debug: true,
})
```

### 3. Browser DevTools Setup

**Add router to global scope for debugging:**

```tsx
// In development only
if (import.meta.env.DEV) {
  window.router = router
}

// Console debugging commands:
// router.state - current router state
// router.navigate() - programmatic navigation
// router.history - navigation history
```

---

## Route Matching Issues

### Problem: Route Not Found (404)

**Symptoms:**

- Route exists but shows 404 or "Not Found"
- Console shows route matching failures

**Debugging Steps:**

1. **Check Route Path Definition**

```tsx
// ❌ Common mistake - missing leading slash
const route = createRoute({
  path: 'about', // Should be '/about'
  // ...
})

// ✅ Correct
const route = createRoute({
  path: '/about',
  // ...
})
```

2. **Verify Route Tree Structure**

```tsx
// Debug route tree in console
console.log('Route tree:', router.routeTree)
console.log('All routes:', router.routesById)
```

3. **Check Parent Route Configuration**

```tsx
// Ensure parent route is properly defined
const childRoute = createRoute({
  getParentRoute: () => parentRoute, // Must return correct parent
  path: '/child',
  // ...
})
```

### Problem: Route Parameters Not Working

**Symptoms:**

- `useParams()` returns undefined or wrong values
- Route params not being parsed correctly

**Debugging Steps:**

1. **Verify Parameter Syntax**

```tsx
// ❌ Wrong parameter syntax
path: '/users/{id}' // Should use $

// ✅ Correct parameter syntax
path: '/users/$userId'
```

2. **Check Parameter Parsing**

```tsx
const route = createRoute({
  path: '/users/$userId',
  // Add parameter validation/parsing
  params: {
    parse: (params) => ({
      userId: Number(params.userId), // Convert to number
    }),
    stringify: (params) => ({
      userId: String(params.userId), // Convert back to string
    }),
  },
  component: () => {
    const { userId } = Route.useParams()
    console.log('User ID:', userId, typeof userId) // Debug output
    return <div>User {userId}</div>
  },
})
```

3. **Debug Current URL and Params**

```tsx
function DebugParams() {
  const location = useLocation()
  const params = Route.useParams()

  console.log('Current pathname:', location.pathname)
  console.log('Parsed params:', params)

  return null // Just for debugging
}
```

---

## Navigation Issues

### Problem: Navigation Not Working

**Symptoms:**

- Links don't navigate
- Programmatic navigation fails silently
- Browser URL doesn't update

**Debugging Steps:**

1. **Check Link Configuration**

```tsx
// ❌ Common mistakes
<Link to="about">About</Link> // Missing leading slash
<Link href="/about">About</Link> // Wrong prop (href instead of to)

// ✅ Correct
<Link to="/about">About</Link>
```

2. **Debug Navigation Calls**

```tsx
function NavigationDebug() {
  const navigate = useNavigate()

  const handleNavigate = () => {
    console.log('Attempting navigation...')
    navigate({
      to: '/dashboard',
      search: { tab: 'settings' },
    })
      .then(() => console.log('Navigation successful'))
      .catch((err) => console.error('Navigation failed:', err))
  }

  return <button onClick={handleNavigate}>Navigate</button>
}
```

3. **Check Router Context**

```tsx
// Ensure component is inside RouterProvider
function ComponentWithNavigation() {
  const router = useRouter() // Will throw error if outside provider
  console.log('Router state:', router.state)

  return <div>...</div>
}
```

### Problem: Navigation Redirects Unexpectedly

**Symptoms:**

- Navigating to one route but ending up somewhere else
- Infinite redirect loops

**Debugging Steps:**

1. **Check Route Guards**

```tsx
const route = createRoute({
  path: '/dashboard',
  beforeLoad: ({ context, location }) => {
    console.log('Before load - location:', location.pathname)
    console.log('Auth state:', context.auth)

    if (!context.auth.isAuthenticated) {
      console.log('Redirecting to login...')
      throw redirect({ to: '/login' })
    }
  },
  // ...
})
```

2. **Debug Redirect Chains**

```tsx
// Add to router configuration
const router = createRouter({
  routeTree,
  context: {
    /* ... */
  },
  // Log all navigation events
  onNavigate: ({ location, type }) => {
    console.log(`Navigation (${type}):`, location.pathname)
  },
})
```

---

## Data Loading Problems

### Problem: Route Data Not Loading

**Symptoms:**

- `useLoaderData()` returns undefined
- Loading states not working correctly
- Data not refreshing

**Debugging Steps:**

1. **Check Loader Implementation**

```tsx
const route = createRoute({
  path: '/posts',
  loader: async ({ params, context }) => {
    console.log('Loader called with params:', params)

    try {
      const data = await fetchPosts()
      console.log('Loader data:', data)
      return data
    } catch (error) {
      console.error('Loader error:', error)
      throw error
    }
  },
  component: () => {
    const data = Route.useLoaderData()
    console.log('Component data:', data)

    return <div>{/* render data */}</div>
  },
})
```

2. **Debug Loading States**

```tsx
function DataLoadingDebug() {
  const location = useLocation()

  console.log('Route status:', {
    isLoading: location.isLoading,
    isTransitioning: location.isTransitioning,
  })

  return null
}
```

3. **Check Loader Dependencies**

```tsx
const route = createRoute({
  path: '/posts/$postId',
  loader: async ({ params }) => {
    // Loader will re-run when params change
    console.log('Loading post:', params.postId)
    return fetchPost(params.postId)
  },
  // Add dependencies for explicit re-loading
  loaderDeps: ({ search }) => ({
    refresh: search.refresh,
  }),
})
```

---

## Search Parameters Issues

### Problem: Search Params Not Updating

**Symptoms:**

- URL search params don't update
- `useSearch()` returns stale data
- Search validation errors

**Debugging Steps:**

1. **Check Search Validation Schema**

```tsx
const route = createRoute({
  path: '/search',
  validateSearch: (search) => {
    console.log('Raw search params:', search)

    const validated = {
      q: (search.q as string) || '',
      page: Number(search.page) || 1,
    }

    console.log('Validated search params:', validated)
    return validated
  },
  component: () => {
    const search = Route.useSearch()
    console.log('Component search:', search)

    return <div>Query: {search.q}</div>
  },
})
```

2. **Debug Search Navigation**

```tsx
function SearchDebug() {
  const navigate = useNavigate()
  const currentSearch = Route.useSearch()

  const updateSearch = (newSearch: any) => {
    console.log('Current search:', currentSearch)
    console.log('New search:', newSearch)

    navigate({
      to: '.',
      search: (prev) => {
        const updated = { ...prev, ...newSearch }
        console.log('Final search:', updated)
        return updated
      },
    })
  }

  return (
    <button onClick={() => updateSearch({ q: 'test' })}>Update Search</button>
  )
}
```

---

## Performance Issues

### Problem: Excessive Re-renders

**Symptoms:**

- Components re-rendering too often
- Performance lag during navigation
- Memory usage increasing

**Debugging Steps:**

1. **Use React DevTools Profiler**

```tsx
// Wrap your app for profiling
import { Profiler } from 'react'

function App() {
  return (
    <Profiler
      id="Router"
      onRender={(id, phase, actualDuration) => {
        console.log(`${id} ${phase} took ${actualDuration}ms`)
      }}
    >
      <RouterProvider router={router} />
    </Profiler>
  )
}
```

2. **Optimize Route Subscriptions**

```tsx
// ❌ Subscribes to all search params
function MyComponent() {
  const search = Route.useSearch()
  return <div>{search.someSpecificField}</div>
}

// ✅ Subscribe only to specific field
function MyComponent() {
  const someSpecificField = Route.useSearch({
    select: (search) => search.someSpecificField,
  })
  return <div>{someSpecificField}</div>
}
```

3. **Monitor Route State Changes**

```tsx
// Add to router configuration
const router = createRouter({
  routeTree,
  context: {
    /* ... */
  },
  onUpdate: (router) => {
    console.log('Router state updated:', {
      pathname: router.state.location.pathname,
      isLoading: router.state.isLoading,
      matches: router.state.matches.length,
    })
  },
})
```

### Problem: Memory Leaks

**Symptoms:**

- Memory usage constantly increasing
- Browser becomes slow over time
- Route components not cleaning up

**Debugging Steps:**

1. **Check Component Cleanup**

```tsx
function MyComponent() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const subscription = someService.subscribe(setData)

    // ✅ Always clean up subscriptions
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <div>{data}</div>
}
```

2. **Monitor Route Unmounting**

```tsx
function DebuggableComponent() {
  useEffect(() => {
    console.log('Component mounted')

    return () => {
      console.log('Component unmounted')
    }
  }, [])

  return <div>Content</div>
}
```

---

## TypeScript Issues

### Problem: Type Errors with Router

**Symptoms:**

- TypeScript errors in route definitions
- Type inference not working
- Parameter types incorrect

**Debugging Steps:**

1. **Check Route Tree Type Registration**

```tsx
// Ensure this declaration exists
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

2. **Debug Route Type Generation**

```bash
# Check if route types are being generated
ls src/routeTree.gen.ts

# Regenerate route types if needed
npx @tanstack/router-cli generate
```

3. **Use Type Assertions for Debugging**

```tsx
function TypeDebugComponent() {
  const params = Route.useParams()
  const search = Route.useSearch()

  // Add type assertions to check what TypeScript infers
  console.log('Params type:', params as any)
  console.log('Search type:', search as any)

  return null
}
```

---

## Systematic Debugging Process

### 1. Information Gathering

When debugging any router issue, start by collecting this information:

```tsx
function RouterDebugInfo() {
  const router = useRouter()
  const location = useLocation()

  useEffect(() => {
    console.group('🐛 Router Debug Info')
    console.log('Current pathname:', location.pathname)
    console.log('Search params:', location.search)
    console.log('Router state:', router.state)
    console.log('Active matches:', router.state.matches)
    console.log('Route tree:', router.routeTree)
    console.groupEnd()
  }, [location.pathname])

  return null
}

// Add to your app during debugging
;<RouterDebugInfo />
```

### 2. Isolation Testing

Create minimal reproduction:

```tsx
// Minimal route for testing
const testRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/debug',
  component: () => {
    console.log('Test route rendered')
    return <div>Debug Route</div>
  },
})

// Add to route tree temporarily
const routeTree = rootRoute.addChildren([
  // ... other routes
  testRoute, // Add test route
])
```

### 3. Step-by-Step Debugging

1. **Verify basic setup** - Router provider, route tree structure
2. **Check route definitions** - Paths, parent routes, configuration
3. **Test navigation** - Links, programmatic navigation
4. **Validate data flow** - Loaders, search params, context
5. **Monitor performance** - Re-renders, memory usage

---

## Browser Debugging Tips

### Console Commands

```js
// In browser console (when router is on window)

// Current router state
router.state

// Navigate programmatically
router.navigate({ to: '/some-path' })

// Get route by path
router.getRoute('/users/$userId')

// Check if route exists
router.buildLocation({ to: '/some-path' })

// View all registered routes
Object.keys(router.routesById)
```

### Network Tab

Monitor these requests when debugging:

- **Route code chunks** - Check if lazy routes are loading
- **Loader data requests** - Verify API calls from loaders
- **Failed requests** - Look for 404s or failed API calls

### React DevTools

1. **Components Tab** - Find router components and inspect props
2. **Profiler Tab** - Identify performance bottlenecks
3. **Search for components** - Find specific route components quickly

---

## Common Error Messages

### "Route not found"

- Check route path spelling and case sensitivity
- Verify route is added to route tree
- Ensure parent routes are properly configured

### "Cannot read property 'useParams' of undefined"

- Component is likely outside RouterProvider
- Route might not be properly registered
- Check if using correct Route object

### "Invalid search params"

- Check validateSearch schema
- Verify search param types match schema
- Look for required vs optional parameters

### "Navigation was interrupted"

- Usually caused by redirect in beforeLoad
- Check for redirect loops
- Verify authentication logic

---

## Performance Monitoring

### Enable Performance Tracking

```tsx
const router = createRouter({
  routeTree,
  context: {
    /* ... */
  },
  onUpdate: (router) => {
    performance.mark('router-update')
  },
  onLoad: (router) => {
    performance.mark('router-load')
    performance.measure('router-load-time', 'router-update', 'router-load')
  },
})
```

### Monitor Route Loading Times

```tsx
const route = createRoute({
  path: '/slow-route',
  loader: async () => {
    const start = performance.now()
    const data = await fetchData()
    const end = performance.now()

    console.log(`Loader took ${end - start}ms`)
    return data
  },
})
```

---

## Common Next Steps

After debugging router issues, you might want to:

- [How to Set Up Testing](./setup-testing.md) - Add tests to prevent regressions
- [How to Deploy to Production](./deploy-to-production.md) - Ensure issues don't occur in production

<!-- TODO: Uncomment as guides are created
- [How to Optimize Performance](./optimize-performance.md)
- [How to Set Up Error Monitoring](./setup-error-monitoring.md)
-->

## Related Resources

- [TanStack Router DevTools](https://github.com/TanStack/router/tree/main/packages/router-devtools) - Official debugging tools
- [React DevTools](https://react.dev/learn/react-developer-tools) - React-specific debugging
- [Router Core Documentation](../overview.md) - Understanding router internals
