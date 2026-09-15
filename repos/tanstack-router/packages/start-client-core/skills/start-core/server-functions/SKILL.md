---
name: start-core/server-functions
description: >-
  createServerFn (GET/POST), validator (Zod or function),
  useServerFn hook, server context utilities (getRequest,
  getRequestHeader, setResponseHeader, setResponseStatus), error
  handling (throw errors, redirect, notFound), streaming, FormData
  handling, file organization (.functions.ts, .server.ts).
type: sub-skill
library: tanstack-start
library_version: '1.166.2'
requires:
  - start-core
sources:
  - TanStack/router:docs/start/framework/react/guide/server-functions.md
---

# Server Functions

Server functions are type-safe RPCs created with `createServerFn`. They run exclusively on the server but can be called from anywhere — loaders, components, hooks, event handlers, or other server functions.

> **CRITICAL**: Server functions are API endpoints. They are reachable independently of whichever route renders the calling UI. **Auth must be enforced inside the handler (or via middleware) for any server function that touches private data.** Route `beforeLoad` is UX, not the data boundary. See [start-core/auth-server-primitives](../auth-server-primitives/SKILL.md) for the session/middleware pattern.
> **CRITICAL**: Loaders are ISOMORPHIC — they run on BOTH client and server. Database queries, file system access, and secret API keys MUST go inside `createServerFn`, NOT in loaders directly.
> **CRITICAL**: Do not use `"use server"` directives, `getServerSideProps`, or any Next.js/Remix server patterns. TanStack Start uses `createServerFn` exclusively.

## Basic Usage

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET (default)
const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})

// POST
const saveData = createServerFn({ method: 'POST' }).handler(async () => {
  return { success: true }
})
```

## Calling from Loaders

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const posts = await db.query('SELECT * FROM posts')
  return { posts }
})

export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
  component: PostList,
})

function PostList() {
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

## Calling from Components

Use the `useServerFn` hook to call server functions from event handlers:

```tsx
import { useServerFn } from '@tanstack/react-start'

const deletePost = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.delete('posts').where({ id: data.id })
    return { success: true }
  })

function DeleteButton({ postId }: { postId: string }) {
  const deletePostFn = useServerFn(deletePost)

  return (
    <button onClick={() => deletePostFn({ data: { id: postId } })}>
      Delete
    </button>
  )
}
```

## Input Validation

### Basic Validator

```tsx
const greetUser = createServerFn({ method: 'GET' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    return `Hello, ${data.name}!`
  })

await greetUser({ data: { name: 'John' } })
```

### Zod Validator

```tsx
import { z } from 'zod'

const createUser = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    }),
  )
  .handler(async ({ data }) => {
    return `Created user: ${data.name}, age ${data.age}`
  })
```

### FormData

```tsx
const submitForm = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) {
      throw new Error('Expected FormData')
    }
    return {
      name: data.get('name')?.toString() || '',
      email: data.get('email')?.toString() || '',
    }
  })
  .handler(async ({ data }) => {
    return { success: true }
  })
```

## Error Handling

### Errors

```tsx
const riskyFunction = createServerFn().handler(async () => {
  throw new Error('Something went wrong!')
})

try {
  await riskyFunction()
} catch (error) {
  console.log(error.message) // "Something went wrong!"
}
```

### Redirects

```tsx
import { redirect } from '@tanstack/react-router'

const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw redirect({ to: '/login' })
  }
  return user
})
```

### Not Found

```tsx
import { notFound } from '@tanstack/react-router'

const getPost = createServerFn()
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const post = await db.findPost(data.id)
    if (!post) {
      throw notFound()
    }
    return post
  })
```

## Server Context Utilities

Access request/response details inside server function handlers:

```tsx
import { createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  getRequestHeader,
  setResponseHeaders,
  setResponseStatus,
} from '@tanstack/react-start/server'

// Public, non-personalized data — safe to cache shared across users.
const getPublicData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeaders({
    // 'public' is correct ONLY when the response does not depend on identity.
    // For anything tied to a session/user/tenant, use 'private' or 'no-store'.
    'Cache-Control': 'public, max-age=300',
  })
  setResponseStatus(200)
  return fetchPublicData()
})

// Authenticated data — must NOT be 'public'.
const getMyData = createServerFn({ method: 'GET' }).handler(async () => {
  const authHeader = getRequestHeader('Authorization')
  // ... auth check ...

  setResponseHeaders({
    // 'private' = only the user-agent may cache. Vary by Cookie/Authorization
    // so any intermediary that does cache keys by identity, not URL alone.
    'Cache-Control': 'private, max-age=60',
    Vary: 'Cookie, Authorization',
  })
  return fetchPersonalizedData()
})
```

Available utilities:

- `getRequest()` — full Request object
- `getRequestHeader(name)` — single request header
- `setResponseHeader(name, value)` — single response header
- `setResponseHeaders(headers)` — multiple response headers
- `setResponseStatus(code)` — HTTP status code

## File Organization

```text
src/utils/
├── users.functions.ts   # createServerFn wrappers (safe to import anywhere)
├── users.server.ts      # Server-only helpers (DB queries, internal logic)
└── schemas.ts           # Shared validation schemas (client-safe)
```

```tsx
// users.server.ts — server-only helpers
import { db } from '~/db'

export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}
```

```tsx
// users.functions.ts — server functions
import { createServerFn } from '@tanstack/react-start'
import { findUserById } from './users.server'

export const getUser = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return findUserById(data.id)
  })
```

Static imports of server functions are safe — the build replaces implementations with RPC stubs in client bundles.

## Common Mistakes

### 1. CRITICAL: Relying on a route guard to protect a server function

A `beforeLoad` redirect protects the **route's UI**, not the **data endpoint**. `createServerFn` exposes a callable endpoint that an attacker can hit directly — no need to load the route at all. Auth on the endpoint is the security boundary; auth on the route is UX.

```tsx
// WRONG — the route guard doesn't reach the handler
const getMyOrders = createServerFn({ method: 'GET' }).handler(async () => {
  return db.orders.findMany() // ← anyone can call the RPC
})
export const Route = createFileRoute('/_authenticated/orders')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' })
  },
  loader: () => getMyOrders(),
})

// CORRECT — auth enforced on the handler itself
const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return db.orders.findMany({ where: { userId: context.session.userId } })
  })
```

Apply `authMiddleware` (or an equivalent in-handler check) to **every** `createServerFn` that needs auth. See [start-core/auth-server-primitives](../auth-server-primitives/SKILL.md) for the full session/middleware pattern and [start-core/middleware](../middleware/SKILL.md) for composing the factory.

### 2. CRITICAL: Putting server-only code in loaders

```tsx
// WRONG — loader is ISOMORPHIC, runs on BOTH client and server
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await db.query('SELECT * FROM posts')
    return { posts }
  },
})

// CORRECT — use createServerFn for server-only logic
const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const posts = await db.query('SELECT * FROM posts')
  return { posts }
})

export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
})
```

### 3. CRITICAL: Using Next.js / Remix / React Router DOM patterns

If the file lives at `src/pages/`, `app/layout.tsx`, `_app/`, or imports anything from `react-router-dom` or `next/`, it is wrong-framework code. TanStack Start uses `src/routes/` + `createFileRoute` + `createServerFn`.

```tsx
// WRONG — "use server" is a React directive, not used in TanStack Start
'use server'
export async function getUser() { ... }

// WRONG — getServerSideProps is Next.js Pages Router
export async function getServerSideProps() { ... }

// WRONG — Next.js App Router server component data fetching
export default async function Page() {
  const data = await fetch(...).then(r => r.json())
  return <div>{data}</div>
}

// WRONG — Remix
export async function loader({ request }) { ... }
export async function action({ request }) { ... }

// WRONG — react-router-dom (a different library)
import { Link, useNavigate } from 'react-router-dom'

// CORRECT — TanStack Start
import { createServerFn } from '@tanstack/react-start'
import { Link, useNavigate, createFileRoute } from '@tanstack/react-router'

const getUser = createServerFn({ method: 'GET' })
  .handler(async () => { ... })

export const Route = createFileRoute('/users/$id')({
  loader: ({ params }) => getUser({ data: { id: params.id } }),
  component: UserPage,
})
```

If you see `src/pages/`, `app/layout.tsx`, or `react-router-dom` in agent output, the agent is generating for the wrong framework. Build will fail or routes will conflict at runtime.

### 4. HIGH: Dynamic imports for server functions

```tsx
// WRONG — can cause bundler issues
const { getUser } = await import('~/utils/users.functions')

// CORRECT — static imports are safe, build handles environment shaking
import { getUser } from '~/utils/users.functions'
```

### 5. HIGH: Awaiting server function without calling it

`createServerFn` returns a function — it must be invoked with `()`:

```tsx
// WRONG — getItems is a function, not a Promise
const data = await getItems

// CORRECT — call the function
const data = await getItems()

// With validated input
const data = await getItems({ data: { id: '1' } })
```

### 6. CRITICAL: Caching authenticated responses with `Cache-Control: public`

`Cache-Control: public, max-age=N` tells every CDN, proxy, and shared cache between you and the user that this response can be served to anyone. If the response depends on the session (user, tenant, role), the first user's response gets cached and replayed to the next user — a cross-tenant data leak.

```tsx
// WRONG — auth'd response, public cache, leaks to next user via CDN
const getMyOrders = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession() // identity-dependent
  setResponseHeaders({ 'Cache-Control': 'public, max-age=300' })
  return db.orders.findMany({ where: { userId: session.userId } })
})

// CORRECT — private + Vary so any cache that does store it keys by identity
const getMyOrders = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession()
  setResponseHeaders({
    'Cache-Control': 'private, max-age=60',
    Vary: 'Cookie, Authorization',
  })
  return db.orders.findMany({ where: { userId: session.userId } })
})

// ALSO CORRECT — opt out entirely for sensitive data
setResponseHeaders({ 'Cache-Control': 'no-store' })
```

Rule of thumb: if the handler reads a session/cookie/auth header or branches on identity, the response is **not** `public`. Default to `private` (or `no-store` for sensitive data); reach for `public` only on responses that are byte-for-byte identical regardless of who asks. See also [start-core/deployment](../deployment/SKILL.md) for ISR/Cache-Control on full pages.

### 7. MEDIUM: When to wrap with `useServerFn`

`useServerFn` is **required** when the server function uses `throw redirect()` or `throw notFound()` — the hook wires the throw into the router so the redirect actually navigates. For server functions that just return data (call them directly or via `useMutation`/`useQuery`), the hook is optional.

```tsx
// Plain data — direct call is fine (also fine to pass to useMutation/useQuery)
<button onClick={() => deletePost({ data: { id } })}>Delete</button>
useMutation({ mutationFn: deletePost })

// Throws redirect/notFound — MUST wrap with useServerFn so the router handles the throw
const signupFn = useServerFn(signup) // signup throws redirect on success
<button onClick={() => signupFn({ data: form })}>Sign up</button>
```

If in doubt: wrap with `useServerFn`. It's a no-op for plain-data functions and the safe default when a function might later add a redirect.

## Cross-References

- [start-core/execution-model](../execution-model/SKILL.md) — understanding where code runs
- [start-core/middleware](../middleware/SKILL.md) — composing server functions with middleware
- [start-core/auth-server-primitives](../auth-server-primitives/SKILL.md) — sessions, cookies, OAuth, CSRF, rate limiting (the server-side half of auth; `getCurrentUser`/`useSession`-style helpers belong here, not at module scope)
- [router-core/auth-and-guards](../../../../router-core/skills/router-core/auth-and-guards/SKILL.md) — routing-side UX guards; data auth belongs in the server function, server route, or API endpoint handler/middleware
