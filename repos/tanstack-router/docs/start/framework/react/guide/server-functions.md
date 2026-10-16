---
id: server-functions
title: Server Functions
---

## What are Server Functions?

Server functions let you define server-only logic that can be called from anywhere in your application - loaders, components, hooks, or other server functions. They run on the server but can be invoked from client code seamlessly.

```tsx
import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn().handler(async () => {
  // This runs only on the server
  return new Date().toISOString()
})

// Call from anywhere - components, loaders, hooks, etc.
const time = await getServerTime()
```

Server functions provide server capabilities (database access, environment variables, file system) while maintaining type safety across the network boundary.

> [!NOTE]
> Server functions are meant to be called by your TanStack Start application. They are easy to use from your app code, and Start handles serialization across the client/server boundary. If you need an endpoint that can be called from outside your Start app, use [server routes](./server-routes) instead.

## Same-Origin Requests

Server functions are same-origin RPC endpoints for your application. Browser requests to server functions should come from the same origin, verified with Fetch Metadata (`Sec-Fetch-Site`), `Origin`, or `Referer` headers. Use server routes for public APIs or endpoints that intentionally support cross-origin requests.

TanStack Start provides `createCsrfMiddleware()` to protect server functions from cross-site requests. If your app does not define `src/start.ts`, Start installs this middleware automatically for server functions. If you define `src/start.ts`, add the middleware explicitly:

```tsx
// src/start.ts
import { createStart, createCsrfMiddleware } from '@tanstack/react-start'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
```

By default, `Origin` and `Referer` checks compare against the incoming request URL origin. If your deployment needs to allow a different public origin, configure it on the CSRF middleware with `createCsrfMiddleware({ origin: 'https://app.example.com' })`.

> [!TIP]
> Requests without any of these headers (`Sec-Fetch-Site`, `Origin`, or `Referer`) are rejected by default. If your deployment strips these headers and you have another layer that guarantees same-origin server function requests, you can opt in with `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn', allowRequestsWithoutOriginCheck: true })`.

## Basic Usage

Server functions are created with `createServerFn()` and can specify HTTP method:

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET request (default)
export const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})

// POST request
export const saveData = createServerFn({ method: 'POST' }).handler(async () => {
  // Server-only logic
  return { success: true }
})
```

## Where to Call Server Functions

Call server functions from:

- **Route loaders** - Perfect for data fetching
- **Components** - Use with `useServerFn()` hook
- **Other server functions** - Compose server logic
- **Event handlers** - Handle form submissions, clicks, etc.

```tsx
// In a route loader
export const Route = createFileRoute('/posts')({
  loader: () => getServerPosts(),
})

// In a component
function PostList() {
  const getPosts = useServerFn(getServerPosts)

  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: () => getPosts(),
  })
}
```

## File Organization

For larger applications, consider organizing server-side code into separate files. Here's one approach:

```
src/utils/
├── users.functions.ts   # Server function wrappers (createServerFn)
├── users.server.ts      # Server-only helpers (DB queries, internal logic)
└── schemas.ts           # Shared validation schemas (client-safe)
```

- **`.functions.ts`** - Export `createServerFn` wrappers, safe to import anywhere
- **`.server.ts`** - Server-only code, only imported inside server function handlers
- **`.ts`** (no suffix) - Client-safe code (types, schemas, constants)

### Example

```tsx
// users.server.ts - Server-only helpers
import { db } from '~/db'

export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}
```

```tsx
// users.functions.ts - Server functions
import { createServerFn } from '@tanstack/react-start'
import { findUserById } from './users.server'

export const getUser = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return findUserById(data.id)
  })
```

### Static Imports Are Safe

Server functions can be statically imported in any file, including client components:

```tsx
// ✅ Safe - build process handles environment shaking
import { getUser } from '~/utils/users.functions'

function UserProfile({ id }) {
  const { data } = useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser({ data: { id } }),
  })
}
```

The build process replaces server function implementations with RPC stubs in client bundles. The actual server code never reaches the browser.

> [!WARNING]
> Avoid dynamic imports for server functions:
>
> ```tsx
> // ❌ Can cause bundler issues
> const { getUser } = await import('~/utils/users.functions')
> ```

## Parameters & Validation

Server functions accept a single `data` parameter. Since they cross the network boundary, validation ensures type safety and runtime correctness.

### Basic Parameters

```tsx
import { createServerFn } from '@tanstack/react-start'

export const greetUser = createServerFn({ method: 'GET' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    return `Hello, ${data.name}!`
  })

await greetUser({ data: { name: 'John' } })
```

### Validation with Zod

For robust validation, use schema libraries like Zod:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
})

export const createUser = createServerFn({ method: 'POST' })
  .validator(UserSchema)
  .handler(async ({ data }) => {
    // data is fully typed and validated
    return `Created user: ${data.name}, age ${data.age}`
  })
```

### Form Data

Handle form submissions with FormData:

```tsx
export const submitForm = createServerFn({ method: 'POST' })
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
    // Process form data
    return { success: true }
  })
```

### Serialization Type Checking

Server function inputs and outputs cross the network boundary, so TypeScript checks that they are serializable:

- Validator input types must be serializable. `FormData` is also allowed for `POST` server functions.
- Handler return types must be serializable. `Response` objects are allowed.

This default behavior is called `strict` mode. If you intentionally need to opt out of these type-level serialization checks, pass the `strict` option to `createServerFn`:

```tsx
// Disable input and output serialization type checks
export const looseServerFn = createServerFn({ strict: false })
  .validator((data: { value: unknown }) => data)
  .handler(async ({ data }) => {
    return data.value
  })

// Disable only input serialization type checks
export const looseInputServerFn = createServerFn({
  strict: { input: false },
})
  .validator((data: { value: unknown }) => data)
  .handler(async () => {
    return { ok: true }
  })

// Disable only output serialization type checks
export const looseOutputServerFn = createServerFn({
  strict: { output: false },
}).handler(async () => {
  return getCustomSerializedValue()
})
```

> [!WARNING]
> `strict: false` only relaxes TypeScript's serialization checks. Values still need to be handled correctly by the runtime serialization layer when they are sent between the client and server. Prefer the default `strict: true` unless you know why the default serializability rules are too restrictive for a specific server function.

## Error Handling & Redirects

Server functions can throw errors, redirects, and not-found responses that are handled automatically when called from route lifecycles or components using `useServerFn()`.

### Basic Errors

```tsx
import { createServerFn } from '@tanstack/react-start'

export const riskyFunction = createServerFn().handler(async () => {
  if (Math.random() > 0.5) {
    throw new Error('Something went wrong!')
  }
  return { success: true }
})

// Errors are serialized to the client
try {
  await riskyFunction()
} catch (error) {
  console.log(error.message) // "Something went wrong!"
}
```

### Redirects

Use redirects for authentication, navigation, etc:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser()

  if (!user) {
    throw redirect({ to: '/login' })
  }

  return user
})
```

### Not Found

Throw not-found errors for missing resources:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'

export const getPost = createServerFn()
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const post = await db.findPost(data.id)

    if (!post) {
      throw notFound()
    }

    return post
  })
```

## Advanced Topics

For more advanced server function patterns and features, see these dedicated guides:

### Server Context & Request Handling

Access request headers, cookies, and customize responses:

```tsx
import { createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  getRequestHeader,
  setResponseHeaders,
  setResponseStatus,
} from '@tanstack/react-start/server'

// Public, non-personalized data — safe to cache shared across users.
export const getPublicData = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeaders(
      new Headers({
        // 'public' is correct ONLY when the response does not depend on identity.
        // For anything tied to a session/user/tenant, see the authenticated example below.
        'Cache-Control': 'public, max-age=300',
        'CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=600',
      }),
    )
    setResponseStatus(200)
    return fetchPublicData()
  },
)
```

> **Cache-Control safety:** `public` tells every CDN/proxy between you and the user that the response can be served to anyone. If the handler reads a session, cookie, or auth header — or branches on identity at all — using `public` will cache one user's response and replay it to the next user (cross-tenant data leak). For authenticated responses, use `private`:

```tsx
// Authenticated data — must NOT be 'public'.
export const getMyOrders = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireSession()
    setResponseHeaders(
      new Headers({
        // 'private' = only the user-agent may cache. Vary by Cookie/Authorization
        // so any intermediary that does cache keys by identity, not URL alone.
        'Cache-Control': 'private, max-age=60',
        Vary: 'Cookie, Authorization',
      }),
    )
    return db.orders.findMany({ where: { userId: session.userId } })
  },
)

// For sensitive data, opt out entirely:
// setResponseHeaders(new Headers({ 'Cache-Control': 'no-store' }))
```

Available utilities:

- `getRequest()` - Access the full Request object
- `getRequestHeader(name)` - Read a specific request header
- `setResponseHeader(name, value)` - Set a single response header
- `setResponseHeaders(headers)` - Set multiple response headers via Headers object
- `setResponseStatus(code)` - Set the HTTP status code

### Streaming

Stream typed data from server functions to the client. See the [Streaming Data from Server Functions guide](./streaming-data-from-server-functions).

### Raw Responses

Return `Response` objects binary data, or custom content types.

### Progressive Enhancement

Use server functions without JavaScript by leveraging the `.url` property with HTML forms.

### Middleware

Compose server functions with middleware for authentication, logging, and shared logic. See the [Middleware guide](./middleware.md).

> **Protect data in the endpoint that serves it.** Server functions are API endpoints reachable independently of whichever route renders the calling UI. Apply `authMiddleware` or an equivalent in-handler check to every server function that reads or writes private data. `beforeLoad` is useful route UX, but it is not the data boundary. See [Authentication Server Primitives](./authentication-server-primitives.md).

### Static Server Functions

Cache server function results at build time for static generation. See [Static Server Functions](./static-server-functions).

### Server Components

Server functions can return Server Components - server-rendered React components that the client can compose. See [Server Components](./server-components.md).

### Request Cancellation

Handle request cancellation with `AbortSignal` for long-running operations.

### Function ID generation for production build

Server functions are addressed by a generated, stable function ID under the hood. These IDs are embedded into the client/SSR builds and used by the server to locate and import the correct module at runtime.

By default, IDs are SHA256 hashes of the same seed to keep bundles compact and avoid leaking file paths.
If two server functions end up with the same ID (including when using a custom generator), the system de-duplicates by appending an incrementing suffix like `_1`, `_2`, etc.

Customization:

You can customize function ID generation for the production build by providing a `generateFunctionId` function when configuring the TanStack Start build tool plugin.

Prefer deterministic inputs (filename + functionName) so IDs remain stable between builds.

Please note that this customization is **experimental** and subject to change.

Example:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      serverFns: {
        generateFunctionId: ({ filename, functionName }) => {
          return crypto
            .createHash('sha1')
            .update(`${filename}--${functionName}`)
            .digest('hex')
        },
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [
    tanstackStart({
      serverFns: {
        generateFunctionId: ({ filename, functionName }) => {
          return crypto
            .createHash('sha1')
            .update(`${filename}--${functionName}`)
            .digest('hex')
        },
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

---

> **Note**: Server functions use a compilation process that extracts server code from client bundles while maintaining seamless calling patterns. On the client, calls become `fetch` requests to the server.
