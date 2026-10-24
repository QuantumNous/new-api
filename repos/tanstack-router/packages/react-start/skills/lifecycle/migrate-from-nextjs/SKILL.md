---
name: lifecycle/migrate-from-nextjs
description: >-
  Step-by-step migration from Next.js App Router to TanStack Start:
  route definition conversion, API mapping, server function
  conversion from Server Actions, middleware conversion, data
  fetching pattern changes.
type: lifecycle
library: tanstack-start
library_version: '1.166.2'
requires:
  - start-core
  - react-start
sources:
  - TanStack/router:docs/start/framework/react/guide/server-functions.md
  - TanStack/router:docs/start/framework/react/guide/middleware.md
  - TanStack/router:docs/start/framework/react/guide/execution-model.md
---

# Migrate from Next.js App Router to TanStack Start

This is a step-by-step migration checklist. Complete tasks in order.

> **CRITICAL**: TanStack Start is isomorphic by default. ALL code runs in both environments unless you use `createServerFn`. This is the opposite of Next.js Server Components, where code is server-only by default.

> **CRITICAL**: TanStack Start uses `createServerFn`, NOT `"use server"` directives. Do not carry over any `"use server"` or `"use client"` directives.

> **CRITICAL**: Types are FULLY INFERRED in TanStack Router/Start. Never cast, never annotate inferred values.

## Pre-Migration

- [ ] **Create a migration branch**

```bash
git checkout -b migrate-to-tanstack-start
```

- [ ] **Install TanStack Start**

```bash
npm i @tanstack/react-start @tanstack/react-router
npm i -D vite @vitejs/plugin-react
```

- [ ] **Remove Next.js**

```bash
npm uninstall next @next/font @next/image
```

## Concept Mapping

| Next.js App Router               | TanStack Start                                                            |
| -------------------------------- | ------------------------------------------------------------------------- |
| `app/page.tsx`                   | `src/routes/index.tsx`                                                    |
| `app/layout.tsx`                 | `src/routes/__root.tsx`                                                   |
| `app/posts/[id]/page.tsx`        | `src/routes/posts/$postId.tsx`                                            |
| `app/api/users/route.ts`         | `src/routes/api/users.ts` (server property)                               |
| `"use server"` + Server Actions  | `createServerFn()`                                                        |
| `"use client"`                   | Not needed (everything is isomorphic)                                     |
| Server Components (default)      | All components are isomorphic; use `createServerFn` for server-only logic |
| `next/navigation` `useRouter`    | `useRouter()` from `@tanstack/react-router`                               |
| `next/link` `Link`               | `<Link>` from `@tanstack/react-router`                                    |
| `next/head` or `metadata` export | `head` property on route                                                  |
| `middleware.ts` (edge)           | `createMiddleware()` in `src/start.ts`                                    |
| `next.config.js`                 | `vite.config.ts` with `tanstackStart()`                                   |
| `generateStaticParams`           | `prerender` config in `vite.config.ts`                                    |

## Step 1: Vite Configuration

Replace `next.config.js` with:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackStart(), // MUST come before react()
    viteReact(),
  ],
})
```

Update `package.json`:

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

## Step 2: Router Factory

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

## Step 3: Convert Layout → Root Route

Next.js:

```tsx
// app/layout.tsx
export const metadata = { title: 'My App' }
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

TanStack Start:

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

## Step 4: Convert Pages → File Routes

Next.js:

```tsx
// app/posts/[id]/page.tsx
export default function PostPage({ params }: { params: { id: string } }) {
  // ...
}
```

TanStack Start:

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()
  // ...
}
```

Key differences:

- Dynamic segments use `$param` not `[param]`
- Params accessed via `Route.useParams()` not component props
- Route path in filename uses `.` or `/` separators

## Step 5: Convert Server Actions → Server Functions

Next.js:

```tsx
// app/actions.ts
'use server'
export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  await db.posts.create({ title })
}
```

TanStack Start:

```tsx
// src/utils/posts.functions.ts
import { createServerFn } from '@tanstack/react-start'

export const createPost = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) throw new Error('Expected FormData')
    return { title: data.get('title')?.toString() || '' }
  })
  .handler(async ({ data }) => {
    await db.posts.create({ title: data.title })
    return { success: true }
  })
```

## Step 6: Convert Data Fetching

Next.js Server Component:

```tsx
// app/posts/page.tsx (Server Component — server-only by default)
export default async function PostsPage() {
  const posts = await db.posts.findMany()
  return <PostList posts={posts} />
}
```

TanStack Start:

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  return db.posts.findMany()
})

export const Route = createFileRoute('/posts')({
  loader: () => getPosts(), // loader is isomorphic, getPosts runs on server
  component: PostsPage,
})

function PostsPage() {
  const posts = Route.useLoaderData()
  return <PostList posts={posts} />
}
```

## Step 7: Convert API Routes → Server Routes

Next.js:

```ts
// app/api/users/route.ts
export async function GET() {
  const users = await db.users.findMany()
  return Response.json(users)
}
```

TanStack Start:

```ts
// src/routes/api/users.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: async () => {
        const users = await db.users.findMany()
        return Response.json(users)
      },
    },
  },
})
```

## Step 8: Convert Navigation

Next.js:

```tsx
import Link from 'next/link'
;<Link href={`/posts/${post.id}`}>View Post</Link>
```

TanStack Start:

```tsx
import { Link } from '@tanstack/react-router'
;<Link to="/posts/$postId" params={{ postId: post.id }}>
  View Post
</Link>
```

Never interpolate params into the `to` string. Use `params` prop.

## Step 9: Convert Middleware

Next.js:

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')
  if (!token) return NextResponse.redirect(new URL('/login', request.url))
}
export const config = { matcher: ['/dashboard/:path*'] }
```

TanStack Start:

```tsx
// src/start.ts — must be manually created
import { createStart, createMiddleware } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cookie = request.headers.get('cookie')
  if (!cookie?.includes('session=')) {
    throw redirect({ to: '/login' })
  }
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [authMiddleware],
}))
```

## Step 10: Convert Metadata/SEO

Next.js:

```tsx
export const metadata = {
  title: 'Post Title',
  description: 'Post description',
}
```

TanStack Start:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => fetchPost(params.postId),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.title },
      { name: 'description', content: loaderData.excerpt },
      { property: 'og:title', content: loaderData.title },
    ],
  }),
})
```

## Post-Migration Checklist

- [ ] Remove all `"use server"` and `"use client"` directives
- [ ] Remove `next.config.js` / `next.config.ts`
- [ ] Remove `app/` directory (replaced by `src/routes/`)
- [ ] Remove `middleware.ts` (replaced by `src/start.ts`)
- [ ] Verify no `next/*` imports remain
- [ ] Run `npm run dev` and check all routes
- [ ] Verify server-only code is inside `createServerFn` (not bare in components/loaders)
- [ ] Check that `<Scripts />` is in the root route `<body>`

## Common Mistakes

### 1. CRITICAL: Keeping Server Component mental model

```tsx
// WRONG — treating component as server-only (Next.js habit)
function PostsPage() {
  const posts = await db.posts.findMany() // fails on client
  return <div>{posts.map(...)}</div>
}

// CORRECT — use server function + loader
const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  return db.posts.findMany()
})

export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
  component: PostsPage,
})
```

### 2. CRITICAL: Using "use server" directive

```tsx
// WRONG — "use server" is Next.js/React pattern
'use server'
export async function myAction() { ... }

// CORRECT — use createServerFn
export const myAction = createServerFn({ method: 'POST' })
  .handler(async () => { ... })
```

### 3. HIGH: Interpolating params into Link href

```tsx
// WRONG — Next.js pattern
<Link to={`/posts/${post.id}`}>View</Link>

// CORRECT — TanStack Router pattern
<Link to="/posts/$postId" params={{ postId: post.id }}>View</Link>
```

## Cross-References

- [react-start](../../react-start/SKILL.md) — full React Start setup
- [start-core/server-functions](../../../../start-client-core/skills/start-core/server-functions/SKILL.md) — server function patterns
- [start-core/execution-model](../../../../start-client-core/skills/start-core/execution-model/SKILL.md) — isomorphic execution
