---
name: solid-start
description: >-
  Solid bindings for TanStack Start: useServerFn hook, tanstackStart
  Vite plugin, StartClient, StartServer, Solid-specific setup,
  re-exports from @tanstack/start-client-core. Full project setup
  with Solid.
type: framework
library: tanstack-start
library_version: '1.166.2'
framework: solid
requires:
  - start-core
sources:
  - TanStack/router:packages/solid-start/src
  - TanStack/router:docs/start/framework/solid/build-from-scratch.md
---

# Solid Start (`@tanstack/solid-start`)

This skill builds on start-core. Read [start-core](../../../start-client-core/skills/start-core/SKILL.md) first for foundational concepts.

This skill covers the Solid-specific bindings, setup, and patterns for TanStack Start.

> **CRITICAL**: All code is ISOMORPHIC by default. Loaders run on BOTH server and client. Use `createServerFn` for server-only logic.

> **CRITICAL**: Do not confuse `@tanstack/solid-start` with SolidStart (`@solidjs/start`). They are completely different frameworks with different APIs.

> **CRITICAL**: Types are FULLY INFERRED. Never cast, never annotate inferred values.

## Package API Surface

`@tanstack/solid-start` re-exports everything from `@tanstack/start-client-core` plus:

- `useServerFn` — Solid hook for calling server functions from components

All core APIs (`createServerFn`, `createMiddleware`, `createStart`, `createIsomorphicFn`, `createServerOnlyFn`, `createClientOnlyFn`) are available from `@tanstack/solid-start`.

Server utilities (`getRequest`, `getRequestHeader`, `setResponseHeader`, `setCookie`, `getCookie`, `useSession`) are imported from `@tanstack/solid-start/server`.

## Full Project Setup

### 1. Install Dependencies

```bash
npm i @tanstack/solid-start @tanstack/solid-router solid-js
npm i -D vite vite-plugin-solid typescript
```

### 2. package.json

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

### 3. tsconfig.json

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "skipLibCheck": true,
    "strictNullChecks": true
  }
}
```

### 4. vite.config.ts

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    tanstackStart(), // MUST come before solid plugin
    solidPlugin({ ssr: true }),
  ],
})
```

### 5. Router Factory (src/router.tsx)

```tsx
import { createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  })
  return router
}
```

### 6. Root Route (src/routes/\_\_root.tsx)

```tsx
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/solid-router'
import { HydrationScript } from 'solid-js/web'
import { Suspense } from 'solid-js'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My TanStack Start App' },
    ],
  }),
  // shellComponent renders the HTML document shell (always SSR'd)
  shellComponent: RootDocument,
})

function RootDocument(props: { children: any }) {
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <Suspense>{props.children}</Suspense>
        <Scripts />
      </body>
    </html>
  )
}
```

### 7. Index Route (src/routes/index.tsx)

```tsx
import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'

const getGreeting = createServerFn({ method: 'GET' }).handler(async () => {
  return 'Hello from TanStack Start!'
})

export const Route = createFileRoute('/')({
  loader: () => getGreeting(),
  component: HomePage,
})

function HomePage() {
  const greeting = Route.useLoaderData()
  return <h1>{greeting()}</h1>
}
```

## useServerFn Hook

Use `useServerFn` to call server functions from Solid components with automatic redirect handling:

```tsx
import { createServerFn, useServerFn } from '@tanstack/solid-start'
import { createSignal } from 'solid-js'

const updatePost = createServerFn({ method: 'POST' })
  .validator((data: { id: string; title: string }) => data)
  .handler(async ({ data }) => {
    await db.posts.update(data.id, { title: data.title })
    return { success: true }
  })

function EditPostForm(props: { postId: string }) {
  const updatePostFn = useServerFn(updatePost)
  const [title, setTitle] = createSignal('')

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        await updatePostFn({ data: { id: props.postId, title: title() } })
      }}
    >
      <input value={title()} onInput={(e) => setTitle(e.target.value)} />
      <button type="submit">Save</button>
    </form>
  )
}
```

Unlike the React version, `useServerFn` does NOT wrap the returned function in any memoization (no `useCallback` equivalent needed — Solid's `setup` runs once).

## Solid-Specific Components

All routing components from `@tanstack/solid-router` work in Start:

- `<Outlet>` — renders matched child route
- `<Link>` — type-safe navigation
- `<Navigate>` — declarative redirect
- `<HeadContent>` — renders head tags via `@solidjs/meta` (must be in `<body>` — uses portals to inject into `<head>`)
- `<Scripts>` — renders body scripts (must be in `<body>`)
- `<Await>` — renders deferred data with `<Suspense>`
- `<ClientOnly>` — renders children only after hydration
- `<CatchBoundary>` — error boundary wrapping `Solid.ErrorBoundary`

## Hooks Reference

All hooks from `@tanstack/solid-router` work in Start. Most return `Accessor<T>` — call the accessor to read:

- `useRouter()` — router instance (NOT an Accessor)
- `useRouterState()` — `Accessor<T>`, subscribe to router state
- `useNavigate()` — navigation function (NOT an Accessor)
- `useSearch({ from })` — `Accessor<T>`, validated search params
- `useParams({ from })` — `Accessor<T>`, path params
- `useLoaderData({ from })` — `Accessor<T>`, loader data
- `useMatch({ from })` — `Accessor<T>`, full route match
- `useRouteContext({ from })` — `Accessor<T>`, route context
- `Route.useLoaderData()` — `Accessor<T>`, typed loader data (preferred in route files)
- `Route.useSearch()` — `Accessor<T>`, typed search params (preferred in route files)

## Common Mistakes

### 1. CRITICAL: Importing from wrong package

```tsx
// WRONG — this is the SPA router, NOT Start
import { createServerFn } from '@tanstack/solid-router'

// CORRECT — server functions come from solid-start
import { createServerFn } from '@tanstack/solid-start'

// CORRECT — routing APIs come from solid-router (re-exported by Start too)
import { createFileRoute, Link } from '@tanstack/solid-router'
```

### 2. CRITICAL: Forgetting to call Accessor

Most hooks return `Accessor<T>`. Must call to read the value.

```tsx
// WRONG
const data = Route.useLoaderData()
return <h1>{data.message}</h1>

// CORRECT
const data = Route.useLoaderData()
return <h1>{data().message}</h1>
```

### 3. HIGH: Missing Scripts component

Without `<Scripts />` in the root route's `<body>`, client JavaScript doesn't load and the app won't hydrate.

### 4. HIGH: Solid plugin before Start plugin in Vite config

```ts
// WRONG
plugins: [solidPlugin(), tanstackStart()]

// CORRECT
plugins: [tanstackStart(), solidPlugin()]
```

## Cross-References

- [start-core](../../../start-client-core/skills/start-core/SKILL.md) — core Start concepts
- [router-core](../../../router-core/skills/router-core/SKILL.md) — routing fundamentals
- [solid-router](../../../solid-router/skills/solid-router/SKILL.md) — Solid Router hooks and components
