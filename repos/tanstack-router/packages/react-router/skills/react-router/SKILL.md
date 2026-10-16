---
name: react-router
description: >-
  React bindings for TanStack Router: RouterProvider, useRouter,
  useRouterState, useMatch, useMatches, useLocation, useSearch,
  useParams, useNavigate, useLoaderData, useLoaderDeps,
  useRouteContext, useBlocker, useCanGoBack, Link, Navigate,
  Outlet, CatchBoundary, ErrorComponent. React-specific patterns
  for hooks, providers, SSR hydration, and createLink with
  forwardRef.
type: framework
library: tanstack-router
library_version: '1.166.2'
framework: react
requires:
  - router-core
sources:
  - TanStack/router:packages/react-router/src
  - TanStack/router:docs/router/guide/creating-a-router.md
  - TanStack/router:docs/router/installation/manual.md
---

# React Router (`@tanstack/react-router`)

This skill builds on router-core. Read [router-core](../../../router-core/skills/router-core/SKILL.md) first for foundational concepts.

This skill covers the React-specific bindings, components, hooks, and setup for TanStack Router.

> **CRITICAL**: TanStack Router types are FULLY INFERRED. Never cast, never annotate inferred values.
> **CRITICAL**: TanStack Router is CLIENT-FIRST. Loaders run on the client by default, not on the server.
> **CRITICAL**: Do not confuse `@tanstack/react-router` with `react-router-dom`/`react-router`. They are completely different libraries with different APIs.

## Full Setup: File-Based Routing with Vite

### 1. Install Dependencies

```bash
npm install @tanstack/react-router
npm install -D @tanstack/router-plugin @tanstack/react-router-devtools
```

### 2. Configure Vite Plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // MUST come before react()
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
})
```

### 3. Create Root Route

```tsx
// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <nav>
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
      </nav>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
```

### 4. Create Route Files

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <h1>Welcome Home</h1>
}
```

```tsx
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <h1>About</h1>
}
```

### 5. Create Router Instance and Register Types

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

// REQUIRED — without this, Link/useNavigate/useSearch have no type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
```

## Hooks Reference

All hooks are imported from `@tanstack/react-router`.

### `useRouter()`

Access the router instance directly:

```tsx
import { useRouter } from '@tanstack/react-router'

function InvalidateButton() {
  const router = useRouter()
  return <button onClick={() => router.invalidate()}>Refresh data</button>
}
```

### `useRouterState()`

Subscribe to router state changes. Exposes the entire state and thus incurs
a performance cost. For matches or location favor `useMatches` and `useLocation`.

```tsx
import { useRouterState } from '@tanstack/react-router'

function LoadingIndicator() {
  const isLoading = useRouterState({ select: (s) => s.isLoading })
  return isLoading ? <div>Loading...</div> : null
}
```

### `useNavigate()`

Programmatic navigation (prefer `<Link>` for user-clickable elements):

```tsx
import { useNavigate } from '@tanstack/react-router'

function AfterSubmit() {
  const navigate = useNavigate()

  const handleSubmit = async () => {
    await saveData()
    navigate({ to: '/posts/$postId', params: { postId: '123' } })
  }

  return <button onClick={handleSubmit}>Save</button>
}
```

### `useSearch({ from })`

Read validated search params:

```tsx
import { useSearch } from '@tanstack/react-router'

function Pagination() {
  const { page } = useSearch({ from: '/products' })
  return <span>Page {page}</span>
}
```

### `useParams({ from })`

Read path params:

```tsx
import { useParams } from '@tanstack/react-router'

function PostHeader() {
  const { postId } = useParams({ from: '/posts/$postId' })
  return <h2>Post {postId}</h2>
}
```

### `useLoaderData({ from })`

Read data returned from the route loader:

```tsx
import { useLoaderData } from '@tanstack/react-router'

function PostContent() {
  const { post } = useLoaderData({ from: '/posts/$postId' })
  return <article>{post.content}</article>
}
```

### `useMatch({ from })`

Access the full route match (params, search, loader data, context):

```tsx
import { useMatch } from '@tanstack/react-router'

function PostDetails() {
  const match = useMatch({ from: '/posts/$postId' })
  return <div>{match.loaderData.post.title}</div>
}
```

### Other Hooks

All imported from `@tanstack/react-router`:

- **`useMatches()`** — array of all active route matches (useful for breadcrumbs)
- **`useRouteContext({ from })`** — read context from `beforeLoad` or parent routes
- **`useBlocker({ shouldBlockFn })`** — block navigation for unsaved changes
- **`useCanGoBack()`** — returns `boolean`, check if history has entries to go back to
- **`useLocation()`** — current parsed location (`pathname`, `search`, `hash`)
- **`useLinkProps({ to, params?, search? })`** — get `<a>` props for custom link elements
- **`useMatchRoute()`** — returns a function: `matchRoute({ to }) => match | false`

## Components Reference

### `RouterProvider`

Mount the router at the top of your React tree:

```tsx
<RouterProvider router={router} />
```

### `Link`

Type-safe navigation link with `<a>` semantics:

```tsx
<Link to="/posts/$postId" params={{ postId: '42' }}>
  View Post
</Link>
```

### `Outlet`

Renders the matched child route component:

```tsx
function Layout() {
  return (
    <div>
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
```

### `Navigate`

Declarative redirect component:

```tsx
import { Navigate } from '@tanstack/react-router'

function OldPage() {
  return <Navigate to="/new-page" />
}
```

### `Await`

Renders deferred data from unawaited loader promises with Suspense:

```tsx
import { Await } from '@tanstack/react-router'
import { Suspense } from 'react'

function PostWithComments() {
  const { deferredComments } = Route.useLoaderData()
  return (
    <div>
      <h1>Post</h1>
      <Suspense fallback={<div>Loading comments...</div>}>
        <Await promise={deferredComments}>
          {(comments) => (
            <ul>
              {comments.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ul>
          )}
        </Await>
      </Suspense>
    </div>
  )
}
```

### `CatchBoundary`

Error boundary for component-level error handling (route-level errors use `errorComponent` route option):

```tsx
import { CatchBoundary } from '@tanstack/react-router'
;<CatchBoundary
  getResetKey={() => 'widget'}
  onCatch={(error) => console.error(error)}
  errorComponent={({ error }) => <div>Error: {error.message}</div>}
>
  <RiskyWidget />
</CatchBoundary>
```

## React-Specific Patterns

### Custom Link Component with `createLink`

Wrap `Link` in a custom component while preserving type safety:

```tsx
import { createLink } from '@tanstack/react-router'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'

const StyledLinkComponent = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<'a'>
>((props, ref) => (
  <a ref={ref} {...props} className={`styled-link ${props.className ?? ''}`} />
))

const StyledLink = createLink(StyledLinkComponent)

// Usage — same type-safe props as Link
function Nav() {
  return (
    <StyledLink to="/posts/$postId" params={{ postId: '42' }}>
      Post
    </StyledLink>
  )
}
```

### Reusable Components with Router Hooks

To create a component that uses router hooks across multiple routes, pass a union of route paths as the `from` prop:

```tsx
function PostIdDisplay({ from }: { from: '/posts/$id' | '/drafts/$id' }) {
  const { id } = useParams({ from })
  return <span>ID: {id}</span>
}

// Usage in different route components
<PostIdDisplay from="/posts/$id" />
<PostIdDisplay from="/drafts/$id" />
```

This pattern avoids `strict: false` (which returns an imprecise union) while keeping the component reusable across specific known routes.

### Auth Provider Must Wrap RouterProvider

If routes use auth context (via `createRootRouteWithContext`), the auth provider must be an ancestor of `RouterProvider`:

```tsx
// CORRECT — AuthProvider wraps RouterProvider
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

// WRONG — RouterProvider outside auth provider
function App() {
  return (
    <RouterProvider router={router}>
      <AuthProvider>{/* ... */}</AuthProvider>
    </RouterProvider>
  )
}
```

Or use the `Wrap` router option to provide context without wrapping externally:

```tsx
const router = createRouter({
  routeTree,
  Wrap: ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
})
```

## Common Mistakes

### 1. HIGH: Using React hooks in `beforeLoad` or `loader`

`beforeLoad` and `loader` are NOT React components — they are plain async functions. React hooks cannot be called in them. Pass auth state via router context instead.

```tsx
// WRONG — useAuth is a React hook, cannot be called here
beforeLoad: () => {
  const auth = useAuth()
  if (!auth.user) throw redirect({ to: '/login' })
}

// CORRECT — read auth from router context
beforeLoad: ({ context }) => {
  if (!context.auth.isAuthenticated) {
    throw redirect({ to: '/login' })
  }
}
```

### 2. HIGH: Wrapping RouterProvider inside an auth provider incorrectly

Create the router once with an `undefined!` placeholder, then inject live auth via `RouterProvider`'s `context` prop. Do NOT recreate the router on auth changes — this resets caches and rebuilds the tree.

```tsx
// CORRECT — create router once, inject live auth via context prop
const router = createRouter({
  routeTree,
  context: { auth: undefined! }, // placeholder, filled by RouterProvider
})

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

### 3. MEDIUM: Missing Suspense boundary for `Await`/deferred data

`Await` requires a `<Suspense>` ancestor. Without it, the deferred promise has no fallback UI and throws.

```tsx
// WRONG — no Suspense boundary
<Await promise={deferredData}>{(data) => <div>{data}</div>}</Await>

// CORRECT — wrap in Suspense
<Suspense fallback={<div>Loading...</div>}>
  <Await promise={deferredData}>{(data) => <div>{data}</div>}</Await>
</Suspense>
```

## Cross-References

- [router-core/SKILL.md](../../../router-core/skills/router-core/SKILL.md) — all sub-skills for domain-specific patterns (search params, data loading, navigation, auth, SSR, etc.)
