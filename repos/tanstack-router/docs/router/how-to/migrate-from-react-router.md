---
title: How to Migrate from React Router v7
---

This guide provides a step-by-step process to migrate your application from React Router v7 to TanStack Router. We'll cover the complete migration process from removing React Router dependencies to implementing TanStack Router's type-safe routing patterns.

## Quick Start

**Time Required:** 2-4 hours depending on app complexity  
**Difficulty:** Intermediate  
**Prerequisites:** Basic React knowledge, existing React Router v7 app

### What You'll Accomplish

- Remove React Router v7 dependencies and components
- Install and configure TanStack Router
- Convert route definitions to file-based routing
- Update navigation components and hooks
- Implement type-safe routing patterns
- Handle search params and dynamic routes
- Migrate from React Router v7's new features to TanStack Router equivalents

---

## Complete Migration Process

### Step 1: Prepare for Migration

Before making any changes, prepare your environment and codebase:

**1.1 Create a backup branch**

```bash
git checkout -b migrate-to-tanstack-router
git push -u origin migrate-to-tanstack-router
```

**1.2 Install TanStack Router (keep React Router temporarily)**

```bash
# Install TanStack Router
npm install @tanstack/react-router

# Install development dependencies
npm install -D @tanstack/router-plugin @tanstack/react-router-devtools
```

**1.3 Set up the router plugin for your bundler**

For **Vite** users, update your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter(), // Add this before react plugin
    react(),
  ],
})
```

For **other bundlers**, see our [bundler configuration guides](../routing/routing-concepts.md).

### Step 2: Create TanStack Router Configuration

**2.1 Create router configuration file**

Create `tsr.config.json` in your project root:

```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "quoteStyle": "single"
}
```

**2.2 Create routes directory**

```bash
mkdir src/routes
```

### Step 3: Convert Your React Router v7 Structure

**3.1 Identify your current React Router v7 setup**

React Router v7 introduced several new patterns. Look for:

- `createBrowserRouter` with new data APIs
- Framework mode configurations
- Server-side rendering setup
- New `loader` and `action` functions
- `defer` usage (simplified in v7)
- Type-safe routing features

**3.2 Create root route**

Create `src/routes/__root.tsx`:

```typescript
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      {/* Your existing layout/navbar content */}
      <div className="p-2 flex gap-2">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

**3.3 Create index route**

Create `src/routes/index.tsx` for your home page:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
    </div>
  )
}
```

**3.4 Convert React Router v7 loaders**

React Router v7 simplified loader patterns. Here's how to migrate them:

**React Router v7:**

```typescript
// app/routes/posts.tsx
export async function loader() {
  const posts = await fetchPosts()
  return { posts } // v7 removed need for json() wrapper
}

export default function Posts() {
  const { posts } = useLoaderData()
  return <div>{/* render posts */}</div>
}
```

**TanStack Router equivalent:**
Create `src/routes/posts.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await fetchPosts()
    return { posts }
  },
  component: Posts,
})

function Posts() {
  const { posts } = Route.useLoaderData()
  return <div>{/* render posts */}</div>
}
```

**3.5 Convert dynamic routes**

**React Router v7:**

```typescript
// app/routes/posts.$postId.tsx
export async function loader({ params }) {
  const post = await fetchPost(params.postId)
  return { post }
}

export default function Post() {
  const { post } = useLoaderData()
  return <div>{post.title}</div>
}
```

**TanStack Router equivalent:**
Create `src/routes/posts/$postId.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  component: Post,
})

function Post() {
  const { post } = Route.useLoaderData()
  const { postId } = Route.useParams()
  return <div>{post.title}</div>
}
```

**3.6 Convert React Router v7 actions**

**React Router v7:**

```typescript
export async function action({ request, params }) {
  const formData = await request.formData()
  const result = await updatePost(params.postId, formData)
  return { success: true }
}
```

**TanStack Router equivalent:**

```typescript
export const Route = createFileRoute('/posts/$postId/edit')({
  component: EditPost,
  // Actions are typically handled differently in TanStack Router
  // Use mutations or form libraries like React Hook Form
})

function EditPost() {
  const navigate = useNavigate()

  const handleSubmit = async (formData) => {
    const result = await updatePost(params.postId, formData)
    navigate({ to: '/posts/$postId', params: { postId } })
  }

  return <form onSubmit={handleSubmit}>{/* form */}</form>
}
```

### Step 4: Handle React Router v7 Framework Features

**4.1 Server-Side Rendering Migration**

React Router v7 introduced framework mode with SSR. If you're using this:

**React Router v7 Framework Mode:**

```typescript
// react-router.config.ts
export default {
  ssr: true,
  prerender: ['/'],
}
```

**TanStack Router approach:**

TanStack Router has built-in SSR capabilities. Set up your router for SSR:

```typescript
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: {
    // Add any SSR context here
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export { router }
```

For server-side rendering, use TanStack Router's built-in SSR APIs:

```typescript
// server.tsx
import { createMemoryHistory } from '@tanstack/react-router'
import { StartServer } from '@tanstack/start/server'

export async function render(url: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
  })

  await router.load()

  return (
    <StartServer router={router} />
  )
}
```

**4.2 Code Splitting Migration**

React Router v7 improved code splitting. TanStack Router handles this via lazy routes:

**React Router v7:**

```typescript
const LazyComponent = lazy(() => import('./LazyComponent'))
```

**TanStack Router:**

```typescript
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/lazy-route')({
  component: LazyComponent,
})

function LazyComponent() {
  return <div>Lazy loaded!</div>
}
```

### Step 5: Update Navigation Components

**5.1 Update Link components**

**React Router v7:**

```typescript
import { Link } from 'react-router'

<Link to="/posts/123">View Post</Link>
<Link to="/posts" state={{ from: 'home' }}>Posts</Link>
```

**TanStack Router:**

```typescript
import { Link } from '@tanstack/react-router'

<Link to="/posts/$postId" params={{ postId: '123' }}>View Post</Link>
<Link to="/posts" state={{ from: 'home' }}>Posts</Link>
```

**5.2 Update navigation hooks**

**React Router v7:**

```typescript
import { useNavigate } from 'react-router'

function Component() {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate('/posts/123')
  }
}
```

**TanStack Router:**

```typescript
import { useNavigate } from '@tanstack/react-router'

function Component() {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate({ to: '/posts/$postId', params: { postId: '123' } })
  }
}
```

### Step 6: Handle React Router v7 Specific Features

**6.1 Migrate simplified `defer` usage**

React Router v7 simplified defer by removing the wrapper function:

**React Router v7:**

```typescript
export async function loader() {
  return {
    data: fetchData(), // Promise directly returned
  }
}
```

**TanStack Router:**

TanStack Router uses a different approach for deferred data. Use loading states:

```typescript
export const Route = createFileRoute('/deferred')({
  loader: async () => {
    const data = await fetchData()
    return { data }
  },
  pendingComponent: () => <div>Loading...</div>,
  component: DeferredComponent,
})
```

**6.2 Handle React Router v7's enhanced type safety**

React Router v7 improved type inference. TanStack Router provides even better type safety:

```typescript
// TanStack Router automatically infers types
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    // params.postId is automatically typed as string
    const post = await fetchPost(params.postId)
    return { post }
  },
  component: Post,
})

function Post() {
  // post is automatically typed based on loader return
  const { post } = Route.useLoaderData()
  // postId is automatically typed as string
  const { postId } = Route.useParams()
}
```

### Step 7: Update Your Main Router Setup

**7.1 Replace React Router v7 router creation**

**Before (React Router v7):**

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router'

const router = createBrowserRouter([
  // Your route definitions
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

**After (TanStack Router):**

```typescript
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

### Step 8: Handle Search Parameters

**8.1 React Router v7 to TanStack Router search params**

**React Router v7:**

```typescript
import { useSearchParams } from 'react-router'

function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = searchParams.get('page') || '1'

  const updatePage = (newPage) => {
    setSearchParams({ page: newPage })
  }
}
```

**TanStack Router:**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().catch(1),
  filter: z.string().optional(),
})

export const Route = createFileRoute('/posts')({
  validateSearch: searchSchema,
  component: Posts,
})

function Posts() {
  const navigate = useNavigate({ from: '/posts' })
  const { page, filter } = Route.useSearch()

  const updatePage = (newPage: number) => {
    navigate({ search: (prev) => ({ ...prev, page: newPage }) })
  }
}
```

### Step 9: Remove React Router Dependencies

Only after everything is working with TanStack Router:

**9.1 Remove React Router v7**

```bash
npm uninstall react-router
```

**9.2 Clean up unused imports**

Search your codebase for any remaining React Router imports:

```bash
# Find remaining React Router imports
grep -r "react-router" src/
```

Remove any remaining imports and replace with TanStack Router equivalents.

### Step 10: Add Advanced Type Safety

**10.1 Configure strict TypeScript**

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**10.2 Add search parameter validation**

For routes with search parameters, add validation schemas:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const postsSearchSchema = z.object({
  page: z.number().min(1).catch(1),
  search: z.string().optional(),
  category: z.enum(['tech', 'business', 'lifestyle']).optional(),
})

export const Route = createFileRoute('/posts')({
  validateSearch: postsSearchSchema,
  component: Posts,
})
```

---

## Production Checklist

Before deploying your migrated application:

### Router Configuration

- [ ] Router instance created and properly exported
- [ ] Route tree generated successfully
- [ ] TypeScript declarations registered
- [ ] All route files follow naming conventions

### Route Migration

- [ ] All React Router v7 routes converted to file-based routing
- [ ] Dynamic routes updated with proper parameter syntax
- [ ] Nested routes maintain hierarchy
- [ ] Index routes created where needed
- [ ] Layout routes preserve component structure

### Feature Migration

- [ ] All React Router v7 loaders converted
- [ ] Actions migrated to appropriate patterns
- [ ] Server-side rendering configured (if applicable)
- [ ] Code splitting implemented
- [ ] Type safety enhanced

### Navigation Updates

- [ ] All Link components updated to TanStack Router
- [ ] useNavigate hooks replaced and tested
- [ ] Navigation parameters properly typed
- [ ] Search parameter validation implemented

### Code Cleanup

- [ ] React Router v7 dependencies removed
- [ ] Unused imports cleaned up
- [ ] No React Router references remain
- [ ] TypeScript compilation successful
- [ ] All tests passing

### Testing

- [ ] All routes accessible and rendering correctly
- [ ] Navigation between routes working
- [ ] Back/forward browser buttons functional
- [ ] Search parameters persisting correctly
- [ ] Dynamic routes with parameters working
- [ ] Nested route layouts displaying properly
- [ ] Framework features (SSR, code splitting) working if applicable

---

## Common Problems

### Error: "Cannot use useNavigate outside of context"

**Problem:** You have remaining React Router imports that conflict with TanStack Router.

**Solution:**

1. Search for all React Router imports:
   ```bash
   grep -r "react-router" src/
   ```
2. Replace all imports with TanStack Router equivalents
3. Ensure React Router is completely uninstalled

### TypeScript Errors: Route Parameters

**Problem:** TypeScript showing errors about route parameters not being typed correctly.

**Solution:**

1. Ensure your router is registered in the TypeScript module declaration:
   ```typescript
   declare module '@tanstack/react-router' {
     interface Register {
       router: typeof router
     }
   }
   ```
2. Check that your route files export the Route correctly
3. Verify parameter names match between route definition and usage

### React Router v7 Framework Features Not Working

**Problem:** Missing SSR or code splitting functionality after migration.

**Solution:**

1. TanStack Router has built-in SSR capabilities - use TanStack Start for full-stack applications
2. Use TanStack Router's lazy routes for code splitting
3. Configure SSR using TanStack Router's native APIs
4. Follow the [SSR setup guide](./setup-ssr.md) for detailed instructions

### Routes Not Matching

**Problem:** Routes not rendering or 404 errors for valid routes.

**Solution:**

1. Check file naming follows TanStack Router conventions:
   - Dynamic routes: `$paramName.tsx`
   - Index routes: `index.tsx`
   - Nested routes: proper directory structure
2. Verify route tree generation is working
3. Check that the router plugin is properly configured

### React Router v7 Simplified APIs Not Translating

**Problem:** v7's simplified `defer` or other features don't have direct equivalents.

**Solution:**

1. Use TanStack Router's pending states for loading UX
2. Implement data fetching patterns that fit TanStack Router's architecture
3. Leverage TanStack Router's superior type safety for better DX

---

## React Router v7 vs TanStack Router Feature Comparison

| Feature            | React Router v7     | TanStack Router              |
| ------------------ | ------------------- | ---------------------------- |
| Type Safety        | Good                | Excellent                    |
| File-based Routing | Framework mode only | Built-in                     |
| Search Params      | Basic               | Validated with schemas       |
| Code Splitting     | Good                | Excellent with lazy routes   |
| SSR                | Framework mode      | Built-in with TanStack Start |
| Bundle Size        | Larger              | Smaller                      |
| Learning Curve     | Moderate            | Moderate                     |
| Community          | Large               | Growing                      |

---

## Common Next Steps

After successfully migrating to TanStack Router, consider these enhancements:

### Advanced Features to Explore

- **Route-based code splitting** - Improve performance with lazy loading
- **Search parameter validation** - Type-safe URL state management
- **Route preloading** - Enhance perceived performance
- **Route masking** - Advanced URL management
- **Integration with TanStack Query** - Powerful data fetching

---

## Related Resources

- [TanStack Router Documentation](https://tanstack.com/router) - Complete API reference
- [File-Based Routing Guide](../routing/file-based-routing.md) - Detailed routing concepts
- [Navigation Guide](../guide/navigation.md) - Complete navigation patterns
- [Search Parameters Guide](../guide/search-params.md) - Advanced search param usage
- [Type Safety Guide](../guide/type-safety.md) - TypeScript integration details
- [React Router v7 Changelog](https://reactrouter.com/start/changelog) - What changed in v7
