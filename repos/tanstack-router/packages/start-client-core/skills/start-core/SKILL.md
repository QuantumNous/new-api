---
name: start-core
description: >-
  Core overview for TanStack Start: tanstackStart() Vite plugin,
  getRouter() factory, root route document shell (HeadContent,
  Scripts, Outlet), client/server entry points, routeTree.gen.ts,
  tsconfig configuration. Entry point for all Start skills.
type: core
library: tanstack-start
library_version: '1.166.2'
sources:
  - TanStack/router:docs/start/framework/react/build-from-scratch.md
  - TanStack/router:docs/start/framework/react/quick-start.md
  - TanStack/router:docs/start/framework/react/guide/routing.md
---

# TanStack Start Core

TanStack Start is a full-stack React framework built on TanStack Router and Vite. It adds SSR, streaming, server functions (type-safe RPCs), middleware, server routes, and universal deployment.

> **CRITICAL**: All code in TanStack Start is ISOMORPHIC by default — it runs in BOTH server and client environments. Loaders run on both server AND client. To run code exclusively on the server, use `createServerFn`. This is the #1 AI agent mistake.
> **CRITICAL**: TanStack Start is NOT Next.js. Do not generate `getServerSideProps`, `"use server"` directives, `app/layout.tsx`, or any Next.js/Remix patterns. Use `createServerFn` for server-only code.
> **CRITICAL**: Types are FULLY INFERRED. Never cast, never annotate inferred values.

## Sub-Skills

| Task                                             | Sub-Skill                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Type-safe RPCs, data fetching, mutations         | [start-core/server-functions/SKILL.md](./server-functions/SKILL.md)             |
| Request/function middleware, context, auth       | [start-core/middleware/SKILL.md](./middleware/SKILL.md)                         |
| Server-side auth: sessions, cookies, OAuth, CSRF | [start-core/auth-server-primitives/SKILL.md](./auth-server-primitives/SKILL.md) |
| Isomorphic execution, environment boundaries     | [start-core/execution-model/SKILL.md](./execution-model/SKILL.md)               |
| REST API endpoints alongside app routes          | [start-core/server-routes/SKILL.md](./server-routes/SKILL.md)                   |
| Hosting, SSR modes, prerendering, SEO            | [start-core/deployment/SKILL.md](./deployment/SKILL.md)                         |

## Quick Decision Tree

```text
Need to run code exclusively on the server (DB, secrets)?
  → start-core/server-functions

Need auth checks, logging, or shared logic across server functions?
  → start-core/middleware

Need to add login, sessions, OAuth, CSRF, password reset?
  → start-core/auth-server-primitives

Need to understand where code runs (server vs client)?
  → start-core/execution-model

Need a REST API endpoint (GET/POST/PUT/DELETE)?
  → start-core/server-routes

Need to deploy, configure SSR, or prerender?
  → start-core/deployment
```

## Project Setup

### 1. Install Dependencies

```bash
npm i @tanstack/react-start @tanstack/react-router react react-dom
npm i -D vite @vitejs/plugin-react typescript
```

### 2. Configure Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // MUST come before react()
    tanstackStart(),
    viteReact(),
  ],
})
```

### 3. Create Router Factory

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  })

  return router
}
```

### 4. Create Root Route with Document Shell

```tsx
// src/routes/__root.tsx
import type { ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
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

### 5. Create Index Route with Server Function

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getGreeting = createServerFn({ method: 'GET' }).handler(async () => {
  return { message: 'Hello from the server!' }
})

export const Route = createFileRoute('/')({
  loader: () => getGreeting(),
  component: HomePage,
})

function HomePage() {
  const data = Route.useLoaderData()
  return <h1>{data.message}</h1>
}
```

## Common Mistakes

### 1. CRITICAL: React plugin before Start plugin in Vite config

```ts
// WRONG — route generation and server function compilation fail
plugins: [react(), tanstackStart()]

// CORRECT — Start plugin must come first
plugins: [tanstackStart(), react()]
```

### 2. HIGH: Enabling verbatimModuleSyntax in tsconfig

`verbatimModuleSyntax` causes server bundles to leak into client bundles. Keep it disabled.

### 3. HIGH: Missing Scripts component in root route

The `<Scripts />` component must be rendered in the `<body>` of the root route. Without it, client-side JavaScript does not load and hydration fails.

```tsx
// WRONG — no Scripts
function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  )
}

// CORRECT — Scripts in body
function RootComponent() {
  return (
    <html>
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

## Version Note

This skill targets `@tanstack/react-start` v1.166.2 and `@tanstack/start-client-core` v1.166.2.
