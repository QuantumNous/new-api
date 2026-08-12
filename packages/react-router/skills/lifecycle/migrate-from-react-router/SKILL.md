---
name: lifecycle/migrate-from-react-router
description: >-
  Step-by-step migration from React Router v7 to TanStack Router:
  route definition conversion, Link/useNavigate API differences,
  useSearchParams to validateSearch + useSearch, useParams with from,
  Outlet replacement, loader conversion, code splitting differences.
type: lifecycle
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
  - react-router
sources:
  - TanStack/router:docs/router/how-to/migrate-from-react-router.md
  - TanStack/router:docs/router/installation/migrate-from-react-router.md
---

# Migrate from React Router v7 to TanStack Router

This is a step-by-step migration checklist. Each check covers one conversion task. Complete them in order.

> **CRITICAL**: If your UI is blank after migration, open the console. Errors like "cannot use useNavigate outside of context" mean React Router imports remain alongside TanStack Router imports. Uninstall `react-router` (and `react-router-dom` if present) to surface them as TypeScript errors.
>
> **CRITICAL**: TanStack Router uses `to` + `params` for navigation, NOT template literal paths. Never interpolate params into the `to` string.
>
> **NOTE**: React Router v7 recommends importing from `react-router` (not `react-router-dom`). The `react-router-dom` package still exists but just re-exports from `react-router`. Check for imports from both.

## Pre-Migration

- [ ] **Create a migration branch**

```bash
git checkout -b migrate-to-tanstack-router
```

- [ ] **Install TanStack Router alongside React Router temporarily**

```bash
npm install @tanstack/react-router @tanstack/react-router-devtools
npm install -D @tanstack/router-plugin
```

- [ ] **Configure bundler plugin (Vite example)**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
})
```

- [ ] **Create routes directory**

```bash
mkdir src/routes
```

## Route Definitions

- [ ] **Create root route**

React Router: `<BrowserRouter>` or `createBrowserRouter([{ element: <Layout />, children: [...] }])`

TanStack Router: `src/routes/__root.tsx`

```tsx
// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

- [ ] **Create router instance with type registration**

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
```

- [ ] **Convert each route file to `createFileRoute`**

React Router:

```tsx
// Defined in route config array
{ path: '/posts', element: <Posts />, loader: postsLoader }
```

TanStack Router:

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await fetchPosts()
    return { posts }
  },
  component: PostsPage,
})

function PostsPage() {
  const { posts } = Route.useLoaderData()
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  )
}
```

- [ ] **Convert dynamic routes**

React Router: `/posts/:postId` (colon syntax)

TanStack Router: `/posts/$postId` (dollar syntax)

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  component: PostPage,
})

function PostPage() {
  const { post } = Route.useLoaderData()
  return <article>{post.title}</article>
}
```

## Navigation

- [ ] **Convert all `<Link>` components**

React Router:

```tsx
import { Link } from 'react-router'
;<Link to={`/posts/${postId}`}>View Post</Link>
```

TanStack Router:

```tsx
import { Link } from '@tanstack/react-router'
;<Link to="/posts/$postId" params={{ postId }}>
  View Post
</Link>
```

Key differences:

- `to` is a route path pattern, NOT an interpolated string
- `params` is a separate prop with typed values
- Active styling: use `activeProps={{ className: 'font-bold' }}` or `data-status="active"` attribute for CSS

- [ ] **Convert all `useNavigate` calls**

React Router:

```tsx
import { useNavigate } from 'react-router'
const navigate = useNavigate()
navigate(`/posts/${postId}`)
```

TanStack Router:

```tsx
import { useNavigate } from '@tanstack/react-router'
const navigate = useNavigate()
navigate({ to: '/posts/$postId', params: { postId } })
```

## Search Params

- [ ] **Replace `useSearchParams` with `validateSearch` + `useSearch`**

React Router:

```tsx
import { useSearchParams } from 'react-router'

function Posts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1

  const goToPage = (p: number) => setSearchParams({ page: String(p) })
}
```

TanStack Router:

```tsx
// In the route definition:
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/posts')({
  validateSearch: z.object({
    page: z.number().default(1).catch(1),
  }),
  component: Posts,
})

// In the component:
import { useNavigate } from '@tanstack/react-router'

function Posts() {
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: '/posts' })

  const goToPage = (p: number) => {
    navigate({ search: (prev) => ({ ...prev, page: p }) })
  }
}
```

Key differences:

- Search params are validated and typed at the route level
- `useSearch()` returns typed objects, not `URLSearchParams`
- Update with function form to preserve other params

## Path Params

- [ ] **Update `useParams` with `from` property**

React Router:

```tsx
import { useParams } from 'react-router'
const { postId } = useParams()
```

TanStack Router:

```tsx
import { useParams } from '@tanstack/react-router'
const { postId } = useParams({ from: '/posts/$postId' })
```

Or from within the route component:

```tsx
const { postId } = Route.useParams()
```

## `useLocation` — Common Pitfall

- [ ] **Replace `useLocation` with specific hooks**

React Router's `useLocation` is heavily used, and TanStack Router has a hook with the same name — but they are NOT equivalent. TanStack Router's `useLocation()` returns the router's current location, which during pending navigations may differ from what's currently rendered. Most React Router `useLocation` usage should be replaced with more specific hooks. See [#3110](https://github.com/TanStack/router/issues/3110).

Replace based on what you actually need:

```tsx
// React Router
import { useLocation } from 'react-router'
const location = useLocation()

// ❌ DON'T just swap to TanStack Router's useLocation — it's the "live" URL
import { useLocation } from '@tanstack/react-router'

// ✅ DO use the specific hook for what you need:
import {
  useMatch,
  useMatches,
  useParams,
  useSearch,
} from '@tanstack/react-router'

// Current route match (replaces most useLocation().pathname usage)
const match = useMatch({ from: '/posts/$postId' })

// All active matches (replaces useLocation for breadcrumbs/analytics)
const matches = useMatches()

// Path params (replaces useLocation + manual parsing)
const { postId } = useParams({ from: '/posts/$postId' })

// Search params (replaces useLocation().search parsing)
const { page } = useSearch({ from: '/posts' })
```

## Outlet

- [ ] **Replace React Router `Outlet` with TanStack Router `Outlet`**

The API is identical — just change the import:

```tsx
// Before
import { Outlet } from 'react-router'

// After
import { Outlet } from '@tanstack/react-router'
```

## Loaders

- [ ] **Convert React Router loaders**

React Router (v7):

```tsx
export async function loader({ params }) {
  const post = await fetchPost(params.postId)
  return { post }
}

export default function Post() {
  const { post } = useLoaderData()
  return <div>{post.title}</div>
}
```

TanStack Router:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  component: Post,
})

function Post() {
  const { post } = Route.useLoaderData()
  return <div>{post.title}</div>
}
```

Key differences:

- Loader is a route option, not a separate export
- `useLoaderData()` is called via `Route.useLoaderData()` (or `useLoaderData({ from })`)
- TanStack Router loaders run on the CLIENT by default (not server-only)
- No `json()` wrapper needed — return plain objects

## Code Splitting

- [ ] **Convert lazy route imports** — with `autoCodeSplitting: true` in the plugin config, this is automatic. For manual splitting, use `.lazy.tsx` files:

```tsx
// src/routes/lazy-page.lazy.tsx
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/lazy-page')({
  component: () => <div>Lazy loaded</div>,
})
```

## Cleanup

- [ ] **Remove React Router and verify**

```bash
npm uninstall react-router react-router-dom
grep -r "from 'react-router" src/  # find stale imports
npx tsc --noEmit                    # verify clean build
```

- [ ] **Test all routes** — verify rendering, navigation (incl. back/forward), search params, dynamic params, and loaders

## Common Mistakes

### 1. HIGH: Leaving React Router imports alongside TanStack Router

Both libraries export `Link`, `useNavigate`, `Outlet`, etc. Leftover React Router imports cause "cannot use useNavigate outside of context" errors because the wrong context provider is used.

```tsx
// WRONG — mixed imports
import { Link } from '@tanstack/react-router'
import { useNavigate } from 'react-router' // <- still React Router!

// CORRECT — all from TanStack Router
import { Link, useNavigate } from '@tanstack/react-router'
```

**Fix**: Uninstall `react-router`/`react-router-dom` completely. TypeScript will flag every stale import.

### 2. HIGH: Using React Router `useSearchParams` pattern

```tsx
// WRONG — React Router pattern, returns URLSearchParams
const [searchParams, setSearchParams] = useSearchParams()
const page = Number(searchParams.get('page'))

// CORRECT — TanStack Router pattern, returns typed object
// Route definition:
validateSearch:
  z.object({
    page: z.number().default(1).catch(1),
  }),

// Component:
const { page } = Route.useSearch()
// page is already typed as number — no casting needed
```

### 3. HIGH: Interpolating params into `to` string

```tsx
// WRONG — React Router habit
<Link to={`/posts/${postId}`}>Post</Link>

// CORRECT — TanStack Router: path pattern + params prop
<Link to="/posts/$postId" params={{ postId }}>Post</Link>
```

### 4. MEDIUM: Using `:param` syntax instead of `$param`

```text
React Router: /posts/:postId
TanStack Router: /posts/$postId
```

File naming also uses `$`: `src/routes/posts/$postId.tsx`

## Quick Reference: API Mapping

| React Router v7              | TanStack Router                                      |
| ---------------------------- | ---------------------------------------------------- |
| `<BrowserRouter>`            | `<RouterProvider router={router} />`                 |
| `<Routes>` / `<Route>`       | File-based: `src/routes/*.tsx`                       |
| `<Link to="/path">`          | `<Link to="/path">`                                  |
| `<Link to={`/posts/${id}`}>` | `<Link to="/posts/$postId" params={{ postId: id }}>` |
| `useNavigate()('/path')`     | `navigate({ to: '/path' })`                          |
| `useParams()`                | `useParams({ from: '/route/$param' })`               |
| `useSearchParams()`          | `validateSearch` + `useSearch({ from })`             |
| `useLoaderData()`            | `Route.useLoaderData()`                              |
| `useLocation()`              | `useMatch`, `useMatches`, `useParams`, `useSearch`   |
| `<Outlet />`                 | `<Outlet />`                                         |
| `loader({ params })`         | `loader: ({ params }) => ...` (route option)         |
| `action({ request })`        | Use mutations / form libraries                       |
| `lazy(() => import(...))`    | `autoCodeSplitting` or `.lazy.tsx` files             |
| `:paramName`                 | `$paramName`                                         |
| `*` (splat)                  | `$` (splat, accessed via `_splat`)                   |
