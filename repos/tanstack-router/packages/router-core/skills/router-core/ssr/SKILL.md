---
name: router-core/ssr
description: >-
  Non-streaming and streaming SSR, RouterClient/RouterServer,
  renderRouterToString/renderRouterToStream, createRequestHandler,
  defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts
  components, head route option (meta/links/styles/scripts),
  ScriptOnce, automatic loader dehydration/hydration, memory
  history on server, data serialization, document head management.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
  - router-core/data-loading
sources:
  - TanStack/router:docs/router/guide/ssr.md
  - TanStack/router:docs/router/guide/document-head-management.md
  - TanStack/router:docs/router/how-to/setup-ssr.md
---

# SSR (Server-Side Rendering)

> **WARNING**: SSR APIs are experimental. They share internal implementations with TanStack Start and may change. **TanStack Start is the recommended way to do SSR in production** — use manual SSR setup only when integrating with an existing server.

> **CRITICAL**: TanStack Router is CLIENT-FIRST. Loaders run on the client by default. With SSR enabled, loaders run on BOTH client AND server. They are NOT server-only like Remix/Next.js loaders. See [router-core/data-loading](../data-loading/SKILL.md).

> **CRITICAL**: Do not generate Next.js patterns (`getServerSideProps`, App Router, server components) or Remix patterns (server-only loader exports). TanStack Router has its own SSR API.

## Concepts

There are two SSR flavors:

- **Non-streaming**: Full page rendered on server, sent as one HTML response, then hydrated on client.
- **Streaming**: Critical first paint sent immediately; remaining content streamed incrementally as it resolves.

Key behaviors:

- Memory history is used automatically on the server (no `window`).
- Loader data is automatically dehydrated on the server and hydrated on the client.
- Data serialization supports `Date`, `Error`, `FormData`, and `undefined` out of the box.

## Setup: Shared Router Factory

The router must be created identically on server and client. Export a factory function from a shared file:

```tsx
// src/router.tsx
import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  return createTanstackRouter({ routeTree })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

## Non-Streaming SSR

### Server Entry (using `defaultRenderHandler`)

```tsx
// src/entry-server.tsx
import {
  createRequestHandler,
  defaultRenderHandler,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export async function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })
  return await handler(defaultRenderHandler)
}
```

### Server Entry (using `renderRouterToString` for custom wrappers)

```tsx
// src/entry-server.tsx
import {
  createRequestHandler,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return handler(({ responseHeaders, router }) =>
    renderRouterToString({
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )
}
```

### Client Entry

```tsx
// src/entry-client.tsx
import { hydrateRoot } from 'react-dom/client'
import { RouterClient } from '@tanstack/react-router/ssr/client'
import { createRouter } from './router'

const router = createRouter()

hydrateRoot(document, <RouterClient router={router} />)
```

## Streaming SSR

### Server Entry (using `defaultStreamHandler`)

```tsx
// src/entry-server.tsx
import {
  createRequestHandler,
  defaultStreamHandler,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export async function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })
  return await handler(defaultStreamHandler)
}
```

### Server Entry (using `renderRouterToStream` for custom wrappers)

```tsx
// src/entry-server.tsx
import {
  createRequestHandler,
  renderRouterToStream,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return handler(({ request, responseHeaders, router }) =>
    renderRouterToStream({
      request,
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )
}
```

Streaming is automatic — deferred data (unawaited promises from loaders) and streamed markup just work when using `defaultStreamHandler` or `renderRouterToStream`.

## Document Head Management

Use the `head` route option to manage `<title>`, `<meta>`, `<link>`, and `<style>` tags. Render `<HeadContent />` in `<head>` and `<Scripts />` in `<body>`.

### Root Route with Head

```tsx
// src/routes/__root.tsx
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'My App' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

### Per-Route Head (Nested Deduplication)

Child route `title` and `meta` tags override parent tags with the same `name`/`property`:

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.post.title },
      { name: 'description', content: loaderData.post.excerpt },
    ],
  }),
  component: PostPage,
})

function PostPage() {
  const { post } = Route.useLoaderData()
  return <article>{post.content}</article>
}
```

### SPA Head (No Full HTML Control)

For SPAs without server-rendered HTML, render `<HeadContent />` at the top of the component tree:

```tsx
import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  head: () => ({
    meta: [{ title: 'My SPA' }],
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
})
```

## Body Scripts

Use `scripts` (separate from `head.scripts`) to inject scripts into `<body>` before the app entry point:

```tsx
export const Route = createRootRoute({
  scripts: () => [{ children: 'console.log("runs before hydration")' }],
})
```

The `<Scripts />` component renders these. Place it at the end of `<body>`.

## ScriptOnce for Pre-Hydration Scripts

`ScriptOnce` renders a `<script>` during SSR that executes immediately and self-removes. On client navigation, it does nothing (no duplicate execution).

```tsx
import { ScriptOnce } from '@tanstack/react-router'

const themeScript = `(function() {
  try {
    const theme = localStorage.getItem('theme') || 'auto';
    const resolved = theme === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.add(resolved);
  } catch (e) {}
})();`

function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScriptOnce children={themeScript} />
      {children}
    </>
  )
}
```

If the script modifies the DOM (e.g., adds a class to `<html>`), use `suppressHydrationWarning` on the element:

```tsx
<html lang="en" suppressHydrationWarning>
```

## Express Integration Example

`createRequestHandler` expects a Web API `Request` and returns a Web API `Response`. For Express, convert between formats:

```tsx
// src/entry-server.tsx
import { pipeline } from 'node:stream/promises'
import {
  RouterServer,
  createRequestHandler,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'
import type express from 'express'

export async function render({
  req,
  res,
}: {
  req: express.Request
  res: express.Response
}) {
  const protocol = req.get('x-forwarded-proto') ?? req.protocol
  const host = req.get('x-forwarded-host') ?? req.get('host')
  const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`).href

  const request = new Request(url, {
    method: req.method,
    headers: (() => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        headers.set(key, value as any)
      }
      return headers
    })(),
  })

  const handler = createRequestHandler({ request, createRouter })

  const response = await handler(({ responseHeaders, router }) =>
    renderRouterToString({
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )

  res.status(response.status)
  response.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })

  return pipeline(response.body as any, res)
}
```

## Common Mistakes

### 1. HIGH: Using browser APIs in loaders without environment check

Loaders run on BOTH client and server with SSR. Browser-only APIs (`window`, `document`, `localStorage`) throw on the server.

```tsx
// WRONG — crashes on server
loader: async () => {
  const token = localStorage.getItem('token')
  return fetchData(token)
}

// CORRECT — guard with environment check
loader: async () => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return fetchData(token)
}
```

### 2. MEDIUM: Using hash fragments for server-rendered content

Hash fragments (`#section`) are never sent to the server. Conditional rendering based on hash causes hydration mismatches.

```tsx
// WRONG — server has no hash, client does → mismatch
component: () => {
  const hash = window.location.hash
  return hash === '#admin' ? <AdminPanel /> : <UserPanel />
}

// CORRECT — use search params for server-visible state
validateSearch: z.object({ view: fallback(z.enum(['admin', 'user']), 'user') }),
component: () => {
  const { view } = Route.useSearch()
  return view === 'admin' ? <AdminPanel /> : <UserPanel />
}
```

### 3. CRITICAL: Generating Next.js, Remix, or React Router DOM patterns

TanStack Router does NOT use `getServerSideProps`, `getStaticProps`, App Router `page.tsx`, Remix-style server-only `loader` exports, or anything from `react-router-dom`.

#### Wrong file structures

```text
WRONG (Next.js Pages Router):
  src/pages/index.tsx
  src/pages/_app.tsx
  src/pages/posts/[id].tsx

WRONG (Next.js App Router):
  app/layout.tsx
  app/page.tsx
  app/posts/[id]/page.tsx

WRONG (Next.js custom App):
  _app/index.tsx
  pages/_app.tsx, pages/_document.tsx

CORRECT (TanStack Router file-based routing):
  src/routes/__root.tsx
  src/routes/index.tsx
  src/routes/posts/$postId.tsx
```

#### Wrong imports

```tsx
// WRONG — react-router-dom is a different library
import {
  Link,
  useNavigate,
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom'

// WRONG — Next.js Link/router
import Link from 'next/link'
import { useRouter } from 'next/router' // Pages Router
import { useRouter } from 'next/navigation' // App Router

// CORRECT — everything routing-related lives in @tanstack/react-router
import {
  Link,
  useNavigate,
  useRouter,
  useLocation,
  redirect,
} from '@tanstack/react-router'
```

#### Wrong loader/data-fetching patterns

```tsx
// WRONG — Next.js Pages Router
export async function getServerSideProps() {
  return { props: { data: await fetchData() } }
}

// WRONG — Remix
export async function loader({ request }: LoaderFunctionArgs) {
  return json({ data: await fetchData() })
}

// CORRECT — TanStack Router
export const Route = createFileRoute('/data')({
  loader: async () => {
    const data = await fetchData()
    return { data }
  },
  component: DataPage,
})

function DataPage() {
  const { data } = Route.useLoaderData()
  return <div>{data}</div>
}
```

If you see `src/pages/`, `app/layout.tsx`, `react-router-dom`, or any of the above in agent output, the agent is generating for the wrong framework. The build will either fail or produce duplicate `/` routes that conflict at runtime.

## Tension: Client-First Loaders vs SSR

TanStack Router loaders are client-first by design. When SSR is enabled, they run in both environments. This means:

- Browser APIs work by default (client-only) but break under SSR
- Database access does NOT belong in loaders (unlike Remix/Next) — use API routes
- For server-only data logic with SSR, use TanStack Start's server functions

See [router-core/data-loading](../data-loading/SKILL.md) for loader fundamentals.

## Cross-References

- [router-core/data-loading](../data-loading/SKILL.md) — SSR changes where loaders execute
- [compositions/router-query](../../../../react-router/skills/compositions/router-query/SKILL.md) — SSR dehydration/hydration with TanStack Query
