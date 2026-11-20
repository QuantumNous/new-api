---
name: start-core/middleware
description: >-
  createMiddleware, request middleware (.server only), server function
  middleware (.client + .server), context passing via next({ context }),
  sendContext for client-server transfer, global middleware via
  createStart in src/start.ts, middleware factories, method order
  enforcement, fetch override precedence.
type: sub-skill
library: tanstack-start
library_version: '1.166.2'
requires:
  - start-core
  - start-core/server-functions
sources:
  - TanStack/router:docs/start/framework/react/guide/middleware.md
---

# Middleware

Middleware customizes the behavior of server functions and server routes. It is composable — middleware can depend on other middleware to form a chain.

> **CRITICAL**: TypeScript enforces method order: `middleware()` → `validator()` → `client()` → `server()`. Wrong order causes type errors.
> **CRITICAL**: Validating the _shape_ of `sendContext` (e.g. `z.string().uuid().parse(...)`) is NOT authorization. A parsed identifier is a well-formed identifier, not an authorized one. Always re-check access against the session principal before using a client-sent ID as a query key, filter, or path parameter.

## Two Types of Middleware

| Feature           | Request Middleware                           | Server Function Middleware               |
| ----------------- | -------------------------------------------- | ---------------------------------------- |
| Scope             | All server requests (SSR, routes, functions) | Server functions only                    |
| Methods           | `.server()`                                  | `.client()`, `.server()`                 |
| Input validation  | No                                           | Yes (`.validator()`)                     |
| Client-side logic | No                                           | Yes                                      |
| Created with      | `createMiddleware()`                         | `createMiddleware({ type: 'function' })` |

Request middleware cannot depend on server function middleware. Server function middleware can depend on both types.

## Request Middleware

Runs on ALL server requests (SSR, server routes, server functions):

```tsx
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createMiddleware } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware().server(
  async ({ next, context, request }) => {
    console.log('Request:', request.url)
    const result = await next()
    return result
  },
)
```

## Server Function Middleware

Has both client and server phases:

```tsx
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createMiddleware } from '@tanstack/react-start'

const authMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    // Runs on client BEFORE the RPC call
    const result = await next()
    // Runs on client AFTER the RPC response
    return result
  })
  .server(async ({ next, context }) => {
    // Runs on server BEFORE the handler
    const result = await next()
    // Runs on server AFTER the handler
    return result
  })
```

## Attaching Middleware to Server Functions

```tsx
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createServerFn } from '@tanstack/react-start'

const fn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context contains data from middleware
    return { user: context.user }
  })
```

## Context Passing via next()

Pass context down the middleware chain:

```tsx
const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await getSession(request.headers)
  if (!session) throw new Error('Unauthorized')

  return next({
    context: { session },
  })
})

const roleMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    console.log('Session:', context.session) // typed!
    return next()
  })
```

## Sending Context Between Client and Server

### Client → Server (sendContext)

```tsx
const workspaceMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next, context }) => {
    return next({
      sendContext: {
        workspaceId: context.workspaceId,
      },
    })
  })
  .server(async ({ next, context }) => {
    // workspaceId available here, but VALIDATE IT
    console.log('Workspace:', context.workspaceId)
    return next()
  })
```

### Server → Client (sendContext in server)

```tsx
const serverTimer = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    return next({
      sendContext: {
        timeFromServer: new Date(),
      },
    })
  },
)

const clientLogger = createMiddleware({ type: 'function' })
  .middleware([serverTimer])
  .client(async ({ next }) => {
    const result = await next()
    console.log('Server time:', result.context.timeFromServer)
    return result
  })
```

## Input Validation in Middleware

```tsx
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'

const workspaceMiddleware = createMiddleware({ type: 'function' })
  .validator(zodValidator(z.object({ workspaceId: z.string() })))
  .server(async ({ next, data }) => {
    console.log('Workspace:', data.workspaceId)
    return next()
  })
```

## Global Middleware

Create `src/start.ts` to configure global middleware:

```tsx
// src/start.ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createStart, createMiddleware } from '@tanstack/react-start'

const requestLogger = createMiddleware().server(async ({ next, request }) => {
  console.log(`${request.method} ${request.url}`)
  return next()
})

const functionAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    // runs for every server function
    return next()
  },
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLogger],
  functionMiddleware: [functionAuth],
}))
```

## Using Middleware with Server Routes

### All handlers in a route

```tsx
export const Route = createFileRoute('/api/users')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => Response.json(context.user),
      POST: async ({ request }) => {
        /* ... */
      },
    },
  },
})
```

### Specific handlers only

```tsx
export const Route = createFileRoute('/api/users')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async () => Response.json({ public: true }),
        POST: {
          middleware: [authMiddleware],
          handler: async ({ context }) => {
            return Response.json({ user: context.session.user })
          },
        },
      }),
  },
})
```

## Middleware Factories

Create parameterized middleware for reusable patterns like authorization:

```tsx
const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await auth.getSession({ headers: request.headers })
  if (!session) throw new Error('Unauthorized')
  return next({ context: { session } })
})
```

> **Attach `authMiddleware` to every `createServerFn` that needs auth.** Server functions are API endpoints; a route `beforeLoad` does not protect their data, only the route's UI. Protect the endpoint that reads or mutates private data. See [router-core/auth-and-guards](../../../../router-core/skills/router-core/auth-and-guards/SKILL.md) and [start-core/auth-server-primitives](../auth-server-primitives/SKILL.md).

```tsx
type Permissions = Record<string, string[]>

function authorizationMiddleware(permissions: Permissions) {
  return createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      const granted = await auth.hasPermission(context.session, permissions)
      if (!granted) throw new Error('Forbidden')
      return next()
    })
}

// Usage
const getClients = createServerFn()
  .middleware([authorizationMiddleware({ client: ['read'] })])
  .handler(async () => {
    return { message: 'The user can read clients.' }
  })
```

## Custom Headers and Fetch

### Setting headers from client middleware

```tsx
const authMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    return next({
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  },
)
```

Headers merge across middleware. Later middleware overrides earlier. Call-site headers override all middleware headers.

### Custom fetch

```tsx
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import type { CustomFetch } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const customFetch: CustomFetch = async (url, init) => {
      console.log('Request:', url)
      return fetch(url, init)
    }
    return next({ fetch: customFetch })
  },
)
```

Fetch precedence (highest to lowest): call site → later middleware → earlier middleware → createStart global → default fetch.

## Common Mistakes

### 1. CRITICAL: Trusting client sendContext — shape check is not access check

`sendContext` from a client middleware arrives on the server as untrusted client input. Most agents stop after parsing the shape with Zod and assume the value is safe. It isn't: a parsed UUID is _some_ workspace, not the requesting user's workspace. Without a membership check against the session principal, you've built a tenant-walking endpoint.

**Layer 1 — WRONG (no validation):**

```tsx
.server(async ({ next, context }) => {
  // SQL-injectable AND tenant-walkable
  await db.query(`SELECT * FROM workspace_${context.workspaceId}`)
  return next()
})
```

**Layer 2 — STILL WRONG (shape only):**

```tsx
.server(async ({ next, context }) => {
  // Looks safe, isn't. UUID is well-formed but the user may not be a member.
  const workspaceId = z.string().uuid().parse(context.workspaceId)
  await db.query('SELECT * FROM workspaces WHERE id = $1', [workspaceId])
  return next()
})
```

**Layer 3 — CORRECT (shape AND access):**

```tsx
.middleware([authMiddleware]) // session loaded from cookie, NOT from sendContext
.server(async ({ next, context }) => {
  const workspaceId = z.string().uuid().parse(context.workspaceId)
  // Verify the session principal can access this workspace.
  const member = await db.memberships.find({
    userId: context.session.userId,
    workspaceId,
  })
  if (!member) throw new Error('Not a member of this workspace')
  await db.query('SELECT * FROM workspaces WHERE id = $1', [workspaceId])
  return next({ context: { workspaceId } })
})
```

The session itself must come from a server-trusted source (the cookie + DB lookup in `authMiddleware`), never from `sendContext` — anything the client can send, the client can lie about. See [start-core/auth-server-primitives](../auth-server-primitives/SKILL.md).

### 2. MEDIUM: Confusing request vs server function middleware

Request middleware runs on ALL requests (SSR, routes, functions). Server function middleware runs only for `createServerFn` calls and has `.client()` method.

### 3. HIGH: Browser APIs in .client() crash during SSR

During SSR, `.client()` callbacks run on the server. Browser-only APIs like `localStorage` or `window` will throw `ReferenceError`:

```tsx
// WRONG — localStorage doesn't exist on the server during SSR
const middleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = localStorage.getItem('token')
    return next({ sendContext: { token } })
  },
)

// CORRECT — use cookies/headers or guard with typeof window check
const middleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null
    return next({ sendContext: { token } })
  },
)
```

### 4. MEDIUM: Wrong method order

```tsx
// WRONG — type error
createMiddleware({ type: 'function' })
  .server(() => { ... })
  .client(() => { ... })

// CORRECT — middleware → validator → client → server
createMiddleware({ type: 'function' })
  .middleware([dep])
  .validator(schema)
  .client(({ next }) => next())
  .server(({ next }) => next())
```

## Cross-References

- [start-core/server-functions](../server-functions/SKILL.md) — what middleware wraps
- [start-core/server-routes](../server-routes/SKILL.md) — middleware on API endpoints
- [start-core/auth-server-primitives](../auth-server-primitives/SKILL.md) — building the `authMiddleware` factory itself: session cookie reads, OAuth state, CSRF
- [router-core/auth-and-guards](../../../../router-core/skills/router-core/auth-and-guards/SKILL.md) — routing-side UX guards; data auth belongs in the server function, server route, or API endpoint handler/middleware
