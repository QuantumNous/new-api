---
name: start-server-core
description: >-
  Server-side runtime for TanStack Start: createStartHandler,
  request/response utilities (getRequest, setResponseHeader,
  setCookie, getCookie, useSession), three-phase request handling,
  AsyncLocalStorage context.
type: core
library: tanstack-start
library_version: '1.166.2'
sources:
  - TanStack/router:packages/start-server-core/src
  - TanStack/router:docs/start/framework/react/guide/server-entry-point.md
---

# Start Server Core (`@tanstack/start-server-core`)

Server-side runtime for TanStack Start. Provides the request handler, request/response utilities, cookie management, and session management. All utilities are available anywhere in the call stack during a request via AsyncLocalStorage.

> **CRITICAL**: These utilities are SERVER-ONLY. Import them from `@tanstack/<framework>-start/server`, not from the main entry point. They throw if called outside a server request context.
>
> **CRITICAL**: Types are FULLY INFERRED. Never cast, never annotate inferred values.

## `createStartHandler`

Creates the main request handler that processes all incoming requests through three phases: server functions, server routes, then app SSR.

```ts
// src/server.ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createStartHandler } from '@tanstack/react-start/server'
import { defaultStreamHandler } from '@tanstack/react-start/server'

export default createStartHandler({
  handler: defaultStreamHandler,
})
```

With asset URL transforms (CDN):

```ts
export default createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: 'https://cdn.example.com',
})
```

## Request Utilities

All imported from `@tanstack/<framework>-start/server`. Available anywhere during request handling — no parameter passing needed.

### Reading Request Data

```ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  getRequestHeaders,
  getRequestHeader,
  getRequestIP,
  getRequestHost,
  getRequestUrl,
  getRequestProtocol,
} from '@tanstack/react-start/server'

const serverFn = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const headers = getRequestHeaders()
  const auth = getRequestHeader('authorization')
  const ip = getRequestIP({ xForwardedFor: true })
  const host = getRequestHost()
  const url = getRequestUrl()
  const protocol = getRequestProtocol()

  return { ip, host }
})
```

### Setting Response Data

```ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createServerFn } from '@tanstack/react-start'
import {
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
  getResponseHeaders,
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  clearResponseHeaders,
} from '@tanstack/react-start/server'

const serverFn = createServerFn({ method: 'POST' }).handler(async () => {
  setResponseStatus(201)
  setResponseHeader('x-custom', 'value')
  setResponseHeaders({ 'cache-control': 'no-store' })

  return { created: true }
})
```

## Cookie Management

```ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createServerFn } from '@tanstack/react-start'
import {
  getCookies,
  getCookie,
  setCookie,
  deleteCookie,
} from '@tanstack/react-start/server'

const serverFn = createServerFn({ method: 'POST' }).handler(async () => {
  const allCookies = getCookies()
  const token = getCookie('session-token')

  setCookie('preference', 'dark', {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  deleteCookie('old-cookie')
})
```

## Session Management

Encrypted sessions stored in cookies. Requires a password for encryption.

```ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createServerFn } from '@tanstack/react-start'
import {
  useSession,
  getSession,
  updateSession,
  clearSession,
} from '@tanstack/react-start/server'

const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: 'my-app-session',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

// Full session manager
const getUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await useSession<{ userId: string }>(sessionConfig)
  return session.data
})

// Update session
const login = createServerFn({ method: 'POST' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    await updateSession(sessionConfig, { userId: data.userId })
    return { success: true }
  })

// Clear session
const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await clearSession(sessionConfig)
  return { success: true }
})
```

### Session Config

| Option     | Type                     | Default     | Description       |
| ---------- | ------------------------ | ----------- | ----------------- |
| `password` | `string`                 | required    | Encryption key    |
| `name`     | `string`                 | `'start'`   | Cookie name       |
| `maxAge`   | `number`                 | `undefined` | Expiry in seconds |
| `cookie`   | `false \| CookieOptions` | `undefined` | Cookie settings   |

### Session Manager Methods

```ts
const session = await useSession<{ userId: string }>(config)

session.id // Session ID (string | undefined)
session.data // Session data (typed)
await session.update({ userId: '123' }) // Persist session data
await session.clear() // Clear session data
```

## Query Validation

Validate query string parameters using a Standard Schema:

```ts
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { getValidatedQuery } from '@tanstack/react-start/server'
import { z } from 'zod'

const serverFn = createServerFn({ method: 'GET' }).handler(async () => {
  const query = await getValidatedQuery(
    z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    }),
  )

  return { page: query.page }
})
```

> Note: `getValidatedQuery` accepts a Standard Schema validator, not a callback function.

## How Request Handling Works

`createStartHandler` processes requests in three phases:

1. **Server Function Dispatch** — If URL matches the server function prefix (`/_serverFn`), deserializes the payload, runs global request middleware, executes the server function, and returns the serialized result.

2. **Server Route Handler** — For non-server-function requests, matches the URL against routes with `server.handlers`. Runs route middleware, then the matched HTTP method handler. Handlers can return a `Response` or call `next()` to fall through to SSR.

3. **App Router SSR** — Loads all route loaders, dehydrates state for client hydration, and calls the handler callback (e.g., `defaultStreamHandler`) to render HTML.

## Common Mistakes

### 1. CRITICAL: Importing server utilities in client code

Server utilities use AsyncLocalStorage and only work during server request handling. Importing them in client code causes build errors or runtime crashes.

```ts
// WRONG — importing in a component file that runs on client
import { getCookie } from '@tanstack/react-start/server'

function MyComponent() {
  const token = getCookie('auth') // crashes on client
}

// CORRECT — use inside server functions only
// Use @tanstack/<framework>-start for your framework (react, solid, vue)
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  return getCookie('auth')
})
```

### 2. HIGH: Forgetting session password for most session operations

`useSession`, `getSession`, `updateSession`, and `sealSession` all require a `password` field for encryption. Missing it throws at runtime. `clearSession` accepts `Partial<SessionConfig>`, so password is optional for clearing.

### 3. MEDIUM: Using session without HTTPS in production

Session cookies should use `secure: true` in production. The default cookie options may not enforce this.

## Cross-References

- [start-core/server-functions](../../../start-client-core/skills/start-core/server-functions/SKILL.md) — creating server functions that use these utilities
- [start-core/middleware](../../../start-client-core/skills/start-core/middleware/SKILL.md) — request middleware
- [start-core/server-routes](../../../start-client-core/skills/start-core/server-routes/SKILL.md) — server route handlers
