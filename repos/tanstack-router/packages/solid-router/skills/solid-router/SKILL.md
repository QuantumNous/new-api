---
name: solid-router
description: >-
  Solid bindings for TanStack Router: RouterProvider, useRouter,
  useRouterState, useMatch, useMatches, useLocation, useSearch,
  useParams, useNavigate, useLoaderData, useLoaderDeps,
  useRouteContext, useBlocker, useCanGoBack, Link, Navigate,
  Outlet, CatchBoundary, ErrorComponent. Solid-specific patterns
  with Accessor<T> returns, createSignal/createMemo/createEffect,
  Show/Switch/Match/Dynamic, and @solidjs/meta for head management.
type: framework
library: tanstack-router
library_version: '1.166.2'
framework: solid
requires:
  - router-core
sources:
  - TanStack/router:packages/solid-router/src
---

# Solid Router (`@tanstack/solid-router`)

This skill builds on router-core. Read [router-core](../../../router-core/skills/router-core/SKILL.md) first for foundational concepts.

This skill covers the Solid-specific bindings, components, hooks, and setup for TanStack Router.

> **CRITICAL**: TanStack Router types are FULLY INFERRED. Never cast, never annotate inferred values.
> **CRITICAL**: TanStack Router is CLIENT-FIRST. Loaders run on the client by default, not on the server.
> **CRITICAL**: Most hooks return `Accessor<T>` — you MUST call the accessor (`value()`) to read the reactive value. This is the #1 difference from the React version.
> **CRITICAL**: Do not confuse `@tanstack/solid-router` with `@solidjs/router`. They are completely different libraries with different APIs.

## Full Setup: File-Based Routing with Vite

### 1. Install Dependencies

```bash
npm install @tanstack/solid-router
npm install -D @tanstack/router-plugin @tanstack/solid-router-devtools
```

### 2. Configure Vite Plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // MUST come before solid plugin
    tanstackRouter({
      target: 'solid',
      autoCodeSplitting: true,
    }),
    solidPlugin(),
  ],
})
```

### 3. Create Root Route

```tsx
// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <nav>
        <Link to="/" activeClass="font-bold">
          Home
        </Link>
        <Link to="/about" activeClass="font-bold">
          About
        </Link>
      </nav>
      <hr />
      <Outlet />
    </>
  )
}
```

### 4. Create Route Files

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <h1>Welcome Home</h1>
}
```

### 5. Create Router Instance and Register Types

```tsx
// src/main.tsx
import { render } from 'solid-js/web'
import { RouterProvider, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

// REQUIRED — without this, Link/useNavigate/useSearch have no type safety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

render(
  () => <RouterProvider router={router} />,
  document.getElementById('root')!,
)
```

## Hooks Reference

All hooks imported from `@tanstack/solid-router`. Most return `Accessor<T>` — call the result to read the value.

### `useRouter()` — returns `TRouter` (NOT an Accessor)

```tsx
import { useRouter } from '@tanstack/solid-router'

function InvalidateButton() {
  const router = useRouter()
  return <button onClick={() => router.invalidate()}>Refresh data</button>
}
```

### `useRouterState()` — returns `Accessor<T>`

Exposes the entire state and thus incurs a performance cost. For matches or location favor `useMatches` and `useLocation`.

```tsx
import { useRouterState } from '@tanstack/solid-router'

function LoadingIndicator() {
  const isLoading = useRouterState({ select: (s) => s.isLoading })
  return (
    <Show when={isLoading()}>
      <div>Loading...</div>
    </Show>
  )
}
```

### `useNavigate()` — returns a function (NOT an Accessor)

```tsx
import { useNavigate } from '@tanstack/solid-router'

function AfterSubmit() {
  const navigate = useNavigate()

  const handleSubmit = async () => {
    await saveData()
    navigate({ to: '/posts/$postId', params: { postId: '123' } })
  }

  return <button onClick={handleSubmit}>Save</button>
}
```

### `useSearch({ from })` — returns `Accessor<T>`

```tsx
import { useSearch } from '@tanstack/solid-router'

function Pagination() {
  const search = useSearch({ from: '/products' })
  return <span>Page {search().page}</span>
}
```

### `useParams({ from })` — returns `Accessor<T>`

```tsx
import { useParams } from '@tanstack/solid-router'

function PostHeader() {
  const params = useParams({ from: '/posts/$postId' })
  return <h2>Post {params().postId}</h2>
}
```

### `useLoaderData({ from })` — returns `Accessor<T>`

```tsx
import { useLoaderData } from '@tanstack/solid-router'

function PostContent() {
  const data = useLoaderData({ from: '/posts/$postId' })
  return <article>{data().post.content}</article>
}
```

### `useMatch({ from })` — returns `Accessor<T>`

```tsx
import { useMatch } from '@tanstack/solid-router'

function PostDetails() {
  const match = useMatch({ from: '/posts/$postId' })
  return <div>{match().loaderData.post.title}</div>
}
```

### Other Hooks

All imported from `@tanstack/solid-router`:

- **`useMatches()`** — `Accessor<Array<Match>>`, all active route matches
- **`useParentMatches()`** — `Accessor<Array<Match>>`, parent route matches
- **`useChildMatches()`** — `Accessor<Array<Match>>`, child route matches
- **`useRouteContext({ from })`** — `Accessor<T>`, context from `beforeLoad`
- **`useLoaderDeps({ from })`** — `Accessor<T>`, loader dependency values
- **`useBlocker({ shouldBlockFn })`** — blocks navigation for unsaved changes
- **`useCanGoBack()`** — `Accessor<boolean>`
- **`useLocation()`** — `Accessor<ParsedLocation>`
- **`useLinkProps({ to, params?, search? })`** — returns `ComponentProps<'a'>` (NOT an Accessor)
- **`useMatchRoute()`** — returns a function; calling it returns `Accessor<false | Params>`
- **`useHydrated()`** — `Accessor<boolean>`

## Components Reference

### `RouterProvider`

```tsx
<RouterProvider router={router} />
```

### `Link`

Type-safe navigation link. Children can be a function for active state:

```tsx
;<Link to="/posts/$postId" params={{ postId: '42' }}>
  View Post
</Link>

{
  /* Function children for active state */
}
;<Link to="/about">
  {(state) => <span classList={{ active: state.isActive }}>About</span>}
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

Declarative redirect (triggers navigation in `onMount`):

```tsx
import { Navigate } from '@tanstack/solid-router'

function OldPage() {
  return <Navigate to="/new-page" />
}
```

### `Await`

Renders deferred data with Solid's `Suspense`:

```tsx
import { Await } from '@tanstack/solid-router'
import { Suspense } from 'solid-js'

function PostWithComments() {
  const data = Route.useLoaderData()
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Await promise={data().deferredComments}>
        {(comments) => <For each={comments}>{(c) => <li>{c.text}</li>}</For>}
      </Await>
    </Suspense>
  )
}
```

### `CatchBoundary`

Error boundary wrapping `Solid.ErrorBoundary`:

```tsx
import { CatchBoundary } from '@tanstack/solid-router'
;<CatchBoundary
  getResetKey={() => 'widget'}
  errorComponent={({ error }) => <div>Error: {error.message}</div>}
>
  <RiskyWidget />
</CatchBoundary>
```

### Other Components

- **`CatchNotFound`** — catches `notFound()` errors in children; `fallback` receives the error data
- **`Block`** — declarative navigation blocker; use `shouldBlockFn` and `withResolver` for custom UI
- **`ScrollRestoration`** — **deprecated**; use `createRouter`'s `scrollRestoration: true` option instead
- **`ClientOnly`** — renders children only after hydration; accepts `fallback` prop

### `Block`

Declarative navigation blocker component:

```tsx
import { Block } from '@tanstack/solid-router'
;<Block shouldBlockFn={() => formIsDirty()} withResolver>
  {({ status, proceed, reset }) => (
    <Show when={status === 'blocked'}>
      <div>
        <p>Are you sure?</p>
        <button onClick={proceed}>Yes</button>
        <button onClick={reset}>No</button>
      </div>
    </Show>
  )}
</Block>
```

### `ScrollRestoration`

Restores scroll position on navigation:

```tsx
import { ScrollRestoration } from '@tanstack/solid-router'
// In root route component
;<ScrollRestoration />
```

### `ClientOnly`

Renders children only after hydration:

```tsx
import { ClientOnly } from '@tanstack/solid-router'
;<ClientOnly fallback={<div>Loading...</div>}>
  <BrowserOnlyWidget />
</ClientOnly>
```

### Head Management

Uses `@solidjs/meta` under the hood:

```tsx
import { HeadContent, Scripts } from '@tanstack/solid-router'

function RootDocument(props) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  )
}
```

## Solid-Specific Patterns

### Custom Link Component with `createLink`

```tsx
import { createLink } from '@tanstack/solid-router'

const StyledLinkComponent = (props) => (
  <a {...props} class={`styled-link ${props.class ?? ''}`} />
)

const StyledLink = createLink(StyledLinkComponent)

function Nav() {
  return (
    <StyledLink to="/posts/$postId" params={{ postId: '42' }}>
      Post
    </StyledLink>
  )
}
```

### Using Solid Primitives with Router State

```tsx
import { createMemo, Show, For } from 'solid-js'
import { useRouterState } from '@tanstack/solid-router'

function Breadcrumbs() {
  const matches = useRouterState({ select: (s) => s.matches })
  const crumbs = createMemo(() =>
    matches().filter((m) => m.context?.breadcrumb),
  )

  return (
    <nav>
      <For each={crumbs()}>
        {(match) => <span>{match.context.breadcrumb}</span>}
      </For>
    </nav>
  )
}
```

### Auth with Router Context

```tsx
import { createRootRouteWithContext } from '@tanstack/solid-router'

const rootRoute = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootComponent,
})

// In main.tsx — provide context at router creation
const router = createRouter({
  routeTree,
  context: { auth: authState },
})

// In a route — access via beforeLoad (NOT hooks)
beforeLoad: ({ context }) => {
  if (!context.auth.isAuthenticated) {
    throw redirect({ to: '/login' })
  }
}
```

## Common Mistakes

### 1. CRITICAL: Forgetting to call Accessor

Hooks return `Accessor<T>` — you must call them to read the value. This is the #1 migration issue from React.

```tsx
// WRONG — comparing the accessor function, not its value
const params = useParams({ from: '/posts/$postId' })
if (params.postId === '42') { ... } // params is a function!

// CORRECT — call the accessor
const params = useParams({ from: '/posts/$postId' })
if (params().postId === '42') { ... }
```

### 2. HIGH: Destructuring reactive values

Destructuring breaks Solid's reactivity tracking.

```tsx
// WRONG — loses reactivity
const { page } = useSearch({ from: '/products' })()

// CORRECT — access through accessor
const search = useSearch({ from: '/products' })
<span>Page {search().page}</span>
```

### 3. HIGH: Using React hooks in beforeLoad or loader

`beforeLoad` and `loader` are NOT components — they are plain async functions. No hooks (React or Solid) can be used in them. Pass state via router context instead.

### 4. MEDIUM: Wrong plugin target

Must set `target: 'solid'` in the router plugin config. Default is `'react'`.

## Cross-References

- [router-core/SKILL.md](../../../router-core/skills/router-core/SKILL.md) — all sub-skills for domain-specific patterns (search params, data loading, navigation, auth, SSR, etc.)
