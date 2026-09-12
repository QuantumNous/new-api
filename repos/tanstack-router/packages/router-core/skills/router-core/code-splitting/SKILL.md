---
name: router-core/code-splitting
description: >-
  Automatic code splitting (autoCodeSplitting), .lazy.tsx convention,
  createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi
  for typed hooks in split files, codeSplitGroupings per-route override,
  splitBehavior programmatic config, critical vs non-critical properties.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/code-splitting.md
  - TanStack/router:docs/router/guide/automatic-code-splitting.md
---

# Code Splitting

TanStack Router separates route code into **critical** (required to match and start loading) and **non-critical** (can be lazy-loaded). The bundler plugin can split automatically, or you can split manually with `.lazy.tsx` files.

> **CRITICAL**: Never `export` component functions from route files — exported functions are included in the main bundle and bypass code splitting entirely.

> **CRITICAL**: Use `getRouteApi('/path')` in code-split files, NOT `import { Route } from './route'`. Importing Route defeats code splitting.

## What Stays in the Main Bundle (Critical)

- Path parsing/serialization
- `validateSearch`
- `loader`, `beforeLoad`
- Route context, static data
- Links, scripts, styles

## What Gets Split (Non-Critical)

- `component`
- `errorComponent`
- `pendingComponent`
- `notFoundComponent`

> The `loader` is NOT split by default. It is already async, so splitting it adds a double async cost: fetch the chunk, then execute the loader. Only split the loader if you have a specific reason.

## Setup: Automatic Code Splitting

Enable `autoCodeSplitting: true` in the bundler plugin. This is the recommended approach.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // TanStack Router plugin MUST come before the framework plugin
    tanstackRouter({
      autoCodeSplitting: true,
    }),
    react(),
  ],
})
```

With this enabled, route files are automatically transformed. Components are split into separate chunks; loaders stay in the main bundle. No `.lazy.tsx` files needed.

```tsx
// src/routes/posts.tsx — everything in one file, splitting is automatic
import { createFileRoute } from '@tanstack/react-router'
import { fetchPosts } from '../api'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: PostsComponent,
})

// NOT exported — this is critical for automatic code splitting to work
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

## Manual Splitting with `.lazy.tsx`

If you cannot use automatic code splitting (e.g. CLI-only, no bundler plugin), split manually into two files:

```tsx
// src/routes/posts.tsx — critical route config only
import { createFileRoute } from '@tanstack/react-router'
import { fetchPosts } from '../api'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
})
```

```tsx
// src/routes/posts.lazy.tsx — non-critical (lazy-loaded)
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/posts')({
  component: PostsComponent,
})

function PostsComponent() {
  // Use getRouteApi to access typed hooks without importing Route
  return <div>Posts</div>
}
```

`createLazyFileRoute` supports only: `component`, `errorComponent`, `pendingComponent`, `notFoundComponent`.

## Virtual Routes

If splitting leaves the critical route file empty, delete it entirely. A virtual route is auto-generated in `routeTree.gen.ts`:

```tsx
// src/routes/about.lazy.tsx — no about.tsx needed
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/about')({
  component: () => <h1>About Us</h1>,
})
```

## Code-Based Splitting

For code-based (non-file-based) routing, use `createLazyRoute` and the `.lazy()` method:

```tsx
// src/posts.lazy.tsx
import { createLazyRoute } from '@tanstack/react-router'

export const Route = createLazyRoute('/posts')({
  component: PostsComponent,
})

function PostsComponent() {
  return <div>Posts</div>
}
```

```tsx
// src/app.tsx
import { createRoute } from '@tanstack/react-router'

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
}).lazy(() => import('./posts.lazy').then((d) => d.Route))
```

## Accessing Typed Hooks in Split Files: `getRouteApi`

When your component lives in a separate file, use `getRouteApi` to get typed access to route hooks without importing the Route object:

```tsx
// src/routes/posts.lazy.tsx
import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts')

export const Route = createLazyFileRoute('/posts')({
  component: PostsComponent,
})

function PostsComponent() {
  const posts = routeApi.useLoaderData()
  const { page } = routeApi.useSearch()
  const params = routeApi.useParams()
  const context = routeApi.useRouteContext()
  return <div>Posts page {page}</div>
}
```

`getRouteApi` provides: `useLoaderData`, `useLoaderDeps`, `useMatch`, `useParams`, `useRouteContext`, `useSearch`.

## Per-Route Split Overrides: `codeSplitGroupings`

Override split behavior for a specific route by adding `codeSplitGroupings` directly in the route file:

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'
import { loadPostsData } from './-heavy-posts-utils'

export const Route = createFileRoute('/posts')({
  // Bundle loader and component together for this route
  codeSplitGroupings: [['loader', 'component']],
  loader: () => loadPostsData(),
  component: PostsComponent,
})

function PostsComponent() {
  const data = Route.useLoaderData()
  return <div>{data.title}</div>
}
```

## Global Split Configuration

### `defaultBehavior` — Change Default Groupings

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      codeSplittingOptions: {
        defaultBehavior: [
          // Bundle all UI components into one chunk
          [
            'component',
            'pendingComponent',
            'errorComponent',
            'notFoundComponent',
          ],
        ],
      },
    }),
  ],
})
```

### `splitBehavior` — Programmatic Per-Route Logic

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      codeSplittingOptions: {
        splitBehavior: ({ routeId }) => {
          if (routeId.startsWith('/posts')) {
            return [['loader', 'component']]
          }
          // All other routes use defaultBehavior
        },
      },
    }),
  ],
})
```

### Precedence Order

1. Per-route `codeSplitGroupings` (highest)
2. `splitBehavior` function
3. `defaultBehavior` option (lowest)

## Common Mistakes

### 1. HIGH: Exporting component functions prevents code splitting

```tsx
// WRONG — export puts PostsComponent in the main bundle
export function PostsComponent() {
  return <div>Posts</div>
}

// CORRECT — no export, function stays in the split chunk
function PostsComponent() {
  return <div>Posts</div>
}
```

### 2. MEDIUM: Trying to code-split the root route

`__root.tsx` does not support code splitting. It is always rendered regardless of the current route. Do not create `__root.lazy.tsx`.

### 3. MEDIUM: Splitting the loader adds double async cost

```tsx
// AVOID unless you have a specific reason
codeSplittingOptions: {
  defaultBehavior: [
    ['loader'], // Fetch chunk THEN execute loader = two network waterfalls
    ['component'],
  ],
}

// PREFERRED — loader stays in main bundle (default behavior)
codeSplittingOptions: {
  defaultBehavior: [
    ['component'],
    ['errorComponent'],
    ['notFoundComponent'],
  ],
}
```

### 4. HIGH: Importing Route in code-split files for typed hooks

```tsx
// WRONG — importing Route pulls route config into the lazy chunk
import { Route } from './posts.tsx'
const data = Route.useLoaderData()

// CORRECT — getRouteApi gives typed hooks without pulling in the route
import { getRouteApi } from '@tanstack/react-router'
const routeApi = getRouteApi('/posts')
const data = routeApi.useLoaderData()
```

## Cross-References

- **router-core/data-loading** — Loader splitting decisions affect data loading performance. Splitting the loader adds latency before data can be fetched.
- **router-core/type-safety** — `getRouteApi` is the type-safe way to access hooks from split files.
