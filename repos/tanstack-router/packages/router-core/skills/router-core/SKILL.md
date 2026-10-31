---
name: router-core
description: >-
  Framework-agnostic core concepts for TanStack Router: route trees,
  createRouter, createRoute, createRootRoute, createRootRouteWithContext,
  addChildren, Register type declaration, route matching, route sorting,
  file naming conventions. Entry point for all router skills.
type: core
library: tanstack-router
library_version: '1.166.2'
---

# TanStack Router Core

TanStack Router is a type-safe router for React and Solid with built-in SWR caching, JSON-first search params, file-based route generation, and end-to-end type inference. The core is framework-agnostic; React and Solid bindings layer on top.

> **CRITICAL**: TanStack Router types are FULLY INFERRED. Never cast, never annotate inferred values. This is the #1 AI agent mistake.

> **CRITICAL**: TanStack Router is CLIENT-FIRST. Loaders run on the client by default, NOT server-only like Remix/Next.js. Do not confuse TanStack Router APIs with Next.js or React Router.

## Sub-Skills

| Task                                               | Sub-Skill                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Validate, read, write, transform search params     | [router-core/search-params/SKILL.md](./search-params/SKILL.md)               |
| Dynamic segments, splats, optional params          | [router-core/path-params/SKILL.md](./path-params/SKILL.md)                   |
| Link, useNavigate, preloading, blocking            | [router-core/navigation/SKILL.md](./navigation/SKILL.md)                     |
| Route loaders, SWR caching, context, deferred data | [router-core/data-loading/SKILL.md](./data-loading/SKILL.md)                 |
| Auth guards, RBAC, beforeLoad redirects            | [router-core/auth-and-guards/SKILL.md](./auth-and-guards/SKILL.md)           |
| Automatic and manual code splitting                | [router-core/code-splitting/SKILL.md](./code-splitting/SKILL.md)             |
| 404 handling, error boundaries, notFound()         | [router-core/not-found-and-errors/SKILL.md](./not-found-and-errors/SKILL.md) |
| Inference, Register, from narrowing, TS perf       | [router-core/type-safety/SKILL.md](./type-safety/SKILL.md)                   |
| Streaming/non-streaming SSR, hydration, head mgmt  | [router-core/ssr/SKILL.md](./ssr/SKILL.md)                                   |

## Quick Decision Tree

```
Need to add/read/write URL query parameters?
  → router-core/search-params

Need dynamic URL segments like /posts/$postId?
  → router-core/path-params

Need to create links or navigate programmatically?
  → router-core/navigation

Need to fetch data for a route?
  Is it client-side only or client+server?
    → router-core/data-loading
  Using TanStack Query as external cache?
    → compositions/router-query (separate skill)

Need to protect routes behind auth?
  → router-core/auth-and-guards

Need to reduce bundle size per route?
  → router-core/code-splitting

Need custom 404 or error handling?
  → router-core/not-found-and-errors

Having TypeScript issues or performance problems?
  → router-core/type-safety

Need server-side rendering?
  → router-core/ssr
```

## Minimal Working Example

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
})
```

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <h1>Home</h1>,
})
```

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

// REQUIRED for type safety — without this, Link/useNavigate have no autocomplete
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default router
```

```tsx
// src/main.tsx
import { RouterProvider } from '@tanstack/react-router'
import router from './router'

function App() {
  return <RouterProvider router={router} />
}
```

## Common Mistakes

### HIGH: createFileRoute path string must match the file path

The Vite plugin manages the path string in `createFileRoute`. Do not change it manually — it must match the file's location under `src/routes/`:

```tsx
// File: src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  // ✅ matches file path
  component: PostPage,
})

export const Route = createFileRoute('/post/$postId')({
  // ❌ silent mismatch
  component: PostPage,
})
```

The plugin auto-generates this string. If you rename a route file, the plugin updates it. Never edit the path string by hand.

## Version Note

This skill targets `@tanstack/router-core` v1.166.2 and `@tanstack/react-router` v1.166.2. APIs are stable. Splat routes use `$` (not `*`); the `*` compat alias will be removed in v2.
