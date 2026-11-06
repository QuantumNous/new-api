---
name: router-core/data-loading
description: >-
  Route loader option, loaderDeps for cache keys, staleTime/gcTime/
  defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/
  pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router
  context and createRootRouteWithContext DI pattern, router.invalidate,
  Await component, deferred data loading with unawaited promises.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/data-loading.md
  - TanStack/router:docs/router/guide/deferred-data-loading.md
  - TanStack/router:docs/router/guide/router-context.md
  - TanStack/router:docs/router/guide/data-mutations.md
---

# Data Loading

## Setup

Basic loader returning data, consumed via `useLoaderData`:

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  component: PostsComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

In code-split components, use `getRouteApi` instead of importing Route:

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts')

function PostsComponent() {
  const posts = routeApi.useLoaderData()
  return <ul>{/* ... */}</ul>
}
```

## Route Loading Lifecycle

The router executes this sequence on every URL/history update:

1. **Route Matching** (top-down)
   - `route.params.parse`
   - `route.validateSearch`
2. **Route Pre-Loading** (serial)
   - `route.beforeLoad`
   - `route.onError` → `route.errorComponent`
3. **Route Loading** (parallel)
   - `route.component.preload?`
   - `route.loader`
     - `route.pendingComponent` (optional)
     - `route.component`
   - `route.onError` → `route.errorComponent`

Key: `beforeLoad` runs before `loader`. `beforeLoad` for a parent runs before its children's `beforeLoad`. Throwing in `beforeLoad` prevents all children from loading.

## Core Patterns

### loaderDeps for Search-Param-Driven Cache Keys

Loaders don't receive search params directly. Use `loaderDeps` to declare which search params affect the cache key:

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  validateSearch: (search) => ({
    offset: Number(search.offset) || 0,
    limit: Number(search.limit) || 10,
  }),
  loaderDeps: ({ search: { offset, limit } }) => ({ offset, limit }),
  loader: ({ deps: { offset, limit } }) => fetchPosts({ offset, limit }),
})
```

When deps change, the route reloads regardless of `staleTime`.

### SWR Caching Configuration

TanStack Router has built-in Stale-While-Revalidate caching keyed on the route's parsed pathname + `loaderDeps`.

Defaults:

- **`staleTime`: 0** — data is always considered stale, reloads in background on re-match
- **`preloadStaleTime`: 30 seconds** — preloaded data won't be refetched for 30s
- **`gcTime`: 30 minutes** — unused cache entries garbage collected after 30min

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: 10_000, // 10s: data considered fresh for 10 seconds
  gcTime: 5 * 60 * 1000, // 5min: garbage collect after 5 minutes
})
```

Disable SWR caching entirely:

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: Infinity,
})
```

Globally:

```tsx
const router = createRouter({
  routeTree,
  defaultStaleTime: Infinity,
})
```

### Pending States (pendingComponent / pendingMs / pendingMinMs)

By default, a pending component shows after 1 second (`pendingMs: 1000`) and stays for at least 500ms (`pendingMinMs: 500`) to avoid flash.

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  pendingMs: 500,
  pendingMinMs: 300,
  pendingComponent: () => <div>Loading posts...</div>,
  component: PostsComponent,
})
```

### Router Context with createRootRouteWithContext (Factory Pattern)

`createRootRouteWithContext` is a factory that returns a function. You must call it twice — the first call passes the generic type, the second passes route options:

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

interface MyRouterContext {
  auth: { userId: string }
  fetchPosts: () => Promise<Post[]>
}

// NOTE: double call — createRootRouteWithContext<Type>()({...})
export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
})
```

Supply the context when creating the router:

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: {
    auth: { userId: '123' },
    fetchPosts,
  },
})
```

Consume in loaders and beforeLoad:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: ({ context: { fetchPosts } }) => fetchPosts(),
})
```

To pass React hook values into the router context, call the hook above `RouterProvider` and inject via the `context` prop:

```tsx
import { RouterProvider } from '@tanstack/react-router'

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

Route-level context via `beforeLoad`:

```tsx
export const Route = createFileRoute('/posts')({
  beforeLoad: () => ({
    fetchPosts: () => fetch('/api/posts').then((r) => r.json()),
  }),
  loader: ({ context: { fetchPosts } }) => fetchPosts(),
})
```

### Deferred Data Loading

Return unawaited promises from the loader for non-critical data. Use the `Await` component to render them:

```tsx
import { createFileRoute, Await } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    // Slow data — do NOT await
    const slowDataPromise = fetchComments(postId)
    // Fast data — await
    const post = await fetchPost(postId)

    return { post, deferredComments: slowDataPromise }
  },
  component: PostComponent,
})

function PostComponent() {
  const { post, deferredComments } = Route.useLoaderData()

  return (
    <div>
      <h1>{post.title}</h1>
      <Await
        promise={deferredComments}
        fallback={<div>Loading comments...</div>}
      >
        {(comments) => (
          <ul>
            {comments.map((c) => (
              <li key={c.id}>{c.body}</li>
            ))}
          </ul>
        )}
      </Await>
    </div>
  )
}
```

### Invalidation After Mutations

`router.invalidate()` forces all active route loaders to re-run and marks all cached data as stale:

```tsx
import { useRouter } from '@tanstack/react-router'

function AddPostButton() {
  const router = useRouter()

  const handleAdd = async () => {
    await fetch('/api/posts', { method: 'POST', body: '...' })
    router.invalidate()
  }

  return <button onClick={handleAdd}>Add Post</button>
}
```

For synchronous invalidation (wait until loaders finish):

```tsx
await router.invalidate({ sync: true })
```

### Error Handling

```tsx
import {
  createFileRoute,
  ErrorComponent,
  useRouter,
} from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error, reset }) => {
    const router = useRouter()

    if (error instanceof CustomError) {
      return <div>{error.message}</div>
    }

    return (
      <div>
        <ErrorComponent error={error} />
        <button
          onClick={() => {
            // For loader errors, invalidate to re-run loader + reset boundary
            router.invalidate()
          }}
        >
          Retry
        </button>
      </div>
    )
  },
})
```

### Loader Parameters

The `loader` function receives:

- `params` — parsed path params
- `deps` — object from `loaderDeps`
- `context` — merged parent + beforeLoad context
- `abortController` — cancelled when route unloads or becomes stale
- `cause` — `'enter'`, `'stay'`, or `'preload'`
- `preload` — `true` during preloading
- `location` — current location object
- `parentMatchPromise` — promise of parent route match
- `route` — the route object itself

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params: { postId }, abortController }) =>
    fetchPost(postId, { signal: abortController.signal }),
})
```

## Common Mistakes

### CRITICAL: Assuming loaders only run on the server

TanStack Router is **client-first**. Loaders run on the **client** by default. They also run on the server when using TanStack Start for SSR, but the default mental model is client-side execution.

```tsx
// WRONG — this will crash in the browser
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const fs = await import('fs') // Node.js only!
    return JSON.parse(fs.readFileSync('...')) // fails in browser
  },
})

// CORRECT — loaders run in the browser, use fetch or API calls
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const res = await fetch('/api/posts')
    return res.json()
  },
})
```

Do NOT put database queries, filesystem access, or server-only code in loaders unless you are using TanStack Start server functions.

### MEDIUM: Not understanding staleTime default is 0

Default `staleTime` is `0`. This means data reloads in the background on every route re-match. This is intentional — it ensures fresh data. But if your data is expensive or static, set `staleTime`:

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: 60_000, // Consider fresh for 1 minute
})
```

### HIGH: Using reset() instead of router.invalidate() in error components

`reset()` only resets the error boundary UI. It does NOT re-run the loader. For loader errors, use `router.invalidate()` which re-runs loaders and resets the boundary:

```tsx
// WRONG — resets boundary but loader still has stale error
function PostErrorComponent({ error, reset }) {
  return <button onClick={reset}>Retry</button>
}

// CORRECT — re-runs loader and resets the error boundary
function PostErrorComponent({ error }) {
  const router = useRouter()
  return <button onClick={() => router.invalidate()}>Retry</button>
}
```

### HIGH: Missing double parentheses on createRootRouteWithContext

`createRootRouteWithContext<Type>()` is a factory — it returns a function. Must call twice:

```tsx
// WRONG — missing second call, passes options to the factory
const rootRoute = createRootRouteWithContext<{ auth: AuthState }>({
  component: RootComponent,
})

// CORRECT — factory()({options})
const rootRoute = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootComponent,
})
```

### HIGH: Using React hooks in beforeLoad or loader

`beforeLoad` and `loader` are NOT React components. You cannot call hooks inside them. Use router context to inject values from hooks:

```tsx
// WRONG — hooks cannot be called outside React components
export const Route = createFileRoute('/posts')({
  loader: () => {
    const auth = useAuth() // This will crash!
    return fetchPosts(auth.userId)
  },
})

// CORRECT — inject hook values via router context
// In your App component:
function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

// In your route:
export const Route = createFileRoute('/posts')({
  loader: ({ context: { auth } }) => fetchPosts(auth.userId),
})
```

### HIGH: Property order affects TypeScript inference

Router infers types from earlier properties into later ones. Declaring `beforeLoad` after `loader` means context from `beforeLoad` is unknown in the loader:

```tsx
// WRONG — context.user is unknown because beforeLoad declared after loader
export const Route = createFileRoute('/admin')({
  loader: ({ context }) => fetchData(context.user),
  beforeLoad: () => ({ user: getUser() }),
})

// CORRECT — validateSearch → loaderDeps → beforeLoad → loader
export const Route = createFileRoute('/admin')({
  beforeLoad: () => ({ user: getUser() }),
  loader: ({ context }) => fetchData(context.user),
})
```

### HIGH: Returning entire search object from loaderDeps

```tsx
// WRONG — loader re-runs on ANY search param change
loaderDeps: ({ search }) => search

// CORRECT — only re-run when page changes
loaderDeps: ({ search }) => ({ page: search.page })
```

Returning the whole `search` object means unrelated param changes (e.g., `sortDirection`, `viewMode`) trigger unnecessary reloads because deep equality fails on the entire object.

## Tensions

- **Client-first loaders vs SSR expectations**: Loaders run on the client by default. When using SSR (TanStack Start), they run on both client and server. Browser-only APIs work by default but break under SSR. Server-only APIs (fs, db) break by default but work under Start server functions. See **router-core/ssr/SKILL.md**.
- **Built-in SWR cache vs external cache coordination**: Router has built-in caching. When using TanStack Query, set `defaultPreloadStaleTime: 0` to avoid double-caching. See **compositions/router-query/SKILL.md**.

---

## Cross-References

- See also: **router-core/search-params/SKILL.md** — `loaderDeps` consumes validated search params as cache keys
- See also: **compositions/router-query/SKILL.md** — for external cache coordination with TanStack Query
