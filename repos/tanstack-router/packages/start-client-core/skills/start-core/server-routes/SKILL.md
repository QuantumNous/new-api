---
name: start-core/server-routes
description: >-
  Server-side API endpoints using the server property on
  createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE),
  createHandlers for per-handler middleware, handler context
  (request, params, context), request body parsing, response
  helpers, file naming for API routes.
type: sub-skill
library: tanstack-start
library_version: '1.166.2'
requires:
  - start-core
sources:
  - TanStack/router:docs/start/framework/react/guide/server-routes.md
---

# Server Routes

Server routes are API endpoints defined alongside app routes in the `src/routes` directory. They use the `server` property on `createFileRoute` and handle raw HTTP requests.

## Basic Server Route

```ts
// src/routes/api/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response('Hello, World!')
      },
    },
  },
})
```

## Combining Server Route and App Route

The same file can define both a server route and a UI route:

```tsx
// src/routes/hello.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        return Response.json({ message: `Hello, ${body.name}!` })
      },
    },
  },
  component: HelloComponent,
})

function HelloComponent() {
  const [reply, setReply] = useState('')
  return (
    <button
      onClick={() => {
        fetch('/hello', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tanner' }),
        })
          .then((res) => res.json())
          .then((data) => setReply(data.message))
      }}
    >
      Say Hello {reply && `- ${reply}`}
    </button>
  )
}
```

## File Route Conventions

Server routes follow TanStack Router file-based routing conventions:

| File                        | Route                         |
| --------------------------- | ----------------------------- |
| `routes/users.ts`           | `/users`                      |
| `routes/users/$id.ts`       | `/users/$id`                  |
| `routes/users/$id/posts.ts` | `/users/$id/posts`            |
| `routes/api/file/$.ts`      | `/api/file/$` (splat)         |
| `routes/my-script[.]js.ts`  | `/my-script.js` (escaped dot) |

## Unique Route Paths

Each route can only have a single handler file. These would conflict:

- `routes/users.ts`
- `routes/users.index.ts`
- `routes/users/index.ts`

## Handler Context

Each handler receives:

- `request` — the incoming [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object
- `params` — dynamic path parameters
- `context` — context from middleware
- `pathname` — the matched pathname
- `next` — call to fall through to SSR (returns a `Response`)

## Dynamic Path Params

```ts
// routes/users/$id.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return new Response(`User ID: ${params.id}`)
      },
    },
  },
})
```

## Splat/Wildcard Params

```ts
// routes/file/$.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/file/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return new Response(`File: ${params._splat}`)
      },
    },
  },
})
```

## Request Body Handling

```ts
export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        return Response.json({ created: body.name })
      },
    },
  },
})
```

Other body methods: `request.text()`, `request.formData()`.

## JSON Responses

```ts
// Using Response.json helper
handlers: {
  GET: async () => {
    return Response.json({ message: 'Hello!' })
  },
}
```

## Status Codes and Headers

```ts
handlers: {
  GET: async ({ params }) => {
    const user = await findUser(params.id)
    if (!user) {
      return new Response('Not found', { status: 404 })
    }
    return Response.json(user)
  },
}
```

```ts
handlers: {
  GET: async () => {
    return new Response('Hello', {
      headers: { 'Content-Type': 'text/plain' },
    })
  },
}
```

## Middleware on Server Routes

### All handlers

```tsx
export const Route = createFileRoute('/api/admin')({
  server: {
    middleware: [authMiddleware, loggerMiddleware],
    handlers: {
      GET: async ({ context }) => Response.json(context.user),
      POST: async ({ request, context }) => {
        /* ... */
      },
    },
  },
})
```

### Specific handlers with createHandlers

```tsx
export const Route = createFileRoute('/api/data')({
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

### Combined route-level and handler-specific

```tsx
export const Route = createFileRoute('/api/posts')({
  server: {
    middleware: [authMiddleware], // runs first for all
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async () => Response.json([]),
        POST: {
          middleware: [validationMiddleware], // runs after auth, POST only
          handler: async ({ request }) => {
            const body = await request.json()
            return Response.json({ created: true })
          },
        },
      }),
  },
})
```

## Common Mistakes

### 1. MEDIUM: Duplicate route paths

```text
# WRONG — both resolve to /users, causes error
routes/users.ts
routes/users/index.ts

# CORRECT — pick one
routes/users.ts
```

### 2. MEDIUM: Forgetting to await request body methods

```ts
// WRONG — body is a Promise, not the actual data
const body = request.json()

// CORRECT — await the promise
const body = await request.json()
```

## Cross-References

- [start-core/middleware](../middleware/SKILL.md) — middleware for server routes
- [start-core/server-functions](../server-functions/SKILL.md) — alternative for RPC-style calls
