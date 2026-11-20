---
id: server-routes
title: Server Routes
---

Server routes are a powerful feature of TanStack Start that allow you to create server-side endpoints in your application and are useful for handling raw HTTP requests, form submissions, user authentication, and much more.

Server routes can be defined in your `./src/routes` directory of your project **right alongside your TanStack Router routes** and are automatically handled by the TanStack Start server.

Here's what a simple server route looks like:

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response('Hello, World!')
      },
    },
  },
})
```

> [!NOTE]
> Server routes are meant for HTTP endpoints that need to be called from outside your TanStack Start application. If you only need to call server-side logic from within your Start app and want Start to handle serialization for you, use [server functions](./server-functions) instead.

## Server Routes and App Routes

Because server routes can be defined in the same directory as your app routes, you can even use the same file for both!

```tsx
// routes/hello.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        return new Response(JSON.stringify({ message: `Hello, ${body.name}!` }))
      },
    },
  },
  component: HelloComponent,
})

function HelloComponent() {
  const [reply, setReply] = useState('')

  return (
    <div>
      <button
        onClick={() => {
          fetch('/hello', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'Tanner' }),
          })
            .then((res) => res.json())
            .then((data) => setReply(data.message))
        }}
      >
        Say Hello
      </button>
    </div>
  )
}
```

## File Route Conventions

Server routes in TanStack Start follow the same file-based routing conventions as TanStack Router. This means that each file in your `routes` directory with a `server` property in the `createFileRoute` call will be treated as an API route. Here are a few examples:

- `/routes/users.ts` will create an API route at `/users`
- `/routes/users.index.ts` will **also** create an API route at `/users` (but will error if duplicate methods are defined)
- `/routes/users/$id.ts` will create an API route at `/users/$id`
- `/routes/users/$id/posts.ts` will create an API route at `/users/$id/posts`
- `/routes/users.$id.posts.ts` will create an API route at `/users/$id/posts`
- `/routes/api/file/$.ts` will create an API route at `/api/file/$`
- `/routes/my-script[.]js.ts` will create an API route at `/my-script.js`

## Unique Route Paths

Each route can only have a single handler file associated with it. So, if you have a file named `routes/users.ts` which'd equal the request path of `/users`, you cannot have other files that'd also resolve to the same route. For example, the following files would all resolve to the same route and would error:

- `/routes/users.index.ts`
- `/routes/users.ts`
- `/routes/users/index.ts`

## Escaped Matching

Just as with normal routes, server routes can match on escaped characters. For example, a file named `routes/users[.]json.ts` will create an API route at `/users.json`.

## Pathless Layout Routes and Break-out Routes

Because of the unified routing system, pathless layout routes and break-out routes are supported for similar functionality around server route middleware.

- Pathless layout routes can be used to add middleware to a group of routes
- Break-out routes can be used to "break out" of parent middleware

## Nested Directories vs File-names

In the examples above, you may have noticed that the file naming conventions are flexible and allow you to mix and match directories and file names. This is intentional and allows you to organize your Server routes in a way that makes sense for your application. You can read more about this in the [TanStack Router File-based Routing Guide](/router/latest/docs/framework/react/routing/file-based-routing#s-or-s).

## Handling Server Route Requests

Server route requests are handled by Start automatically by default or by Start's `createStartHandler` in your custom `src/server.ts` entry point file.

The start handler is responsible for matching an incoming request to a server route and executing the appropriate middleware and handler.

If you need to customize the server handler, you can do so by creating a custom handler and then passing the event to the start handler. See [The Server Entry Point](./server-entry-point).

## Defining a Server Route

Server routes are created by adding a `server` property to your `createFileRoute` call. The `server` property contains:

- `handlers` - Either an object mapping HTTP methods to handler functions, or a function that receives `createHandlers` for more advanced use cases
- `middleware` - Optional route-level middleware array that applies to all handlers

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response('Hello, World! from ' + request.url)
      },
    },
  },
})
```

## Defining Server Route Handlers

You can define handlers in two ways:

- **Simple handlers**: Provide handler functions directly in a handlers object
- **Handlers with middleware**: Use the `createHandlers` function to define handlers with middleware

### Simple handlers

For simple use cases, you can provide handler functions directly in a handlers object.

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response('Hello, World! from ' + request.url)
      },
    },
  },
})
```

### Adding middleware to specific handlers

For more complex use cases, you can add middleware to specific handlers. This requires using the `createHandlers` function:

```tsx
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          middleware: [loggerMiddleware],
          handler: async ({ request }) => {
            return new Response('Hello, World! from ' + request.url)
          },
        },
      }),
  },
})
```

### Adding middleware to all handlers

You can also add middleware that applies to all handlers in a route by using the `middleware` property at the server level:

```tsx
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    middleware: [authMiddleware, loggerMiddleware], // Applies to all handlers
    handlers: {
      GET: async ({ request }) => {
        return new Response('Hello, World! from ' + request.url)
      },
      POST: async ({ request }) => {
        const body = await request.json()
        return new Response(`Hello, ${body.name}!`)
      },
    },
  },
})
```

### Combining route-level and handler-specific middleware

You can combine both approaches - route-level middleware will run first, followed by handler-specific middleware:

```tsx
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    middleware: [authMiddleware], // Runs first for all handlers
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => {
          return new Response('Hello, World!')
        },
        POST: {
          middleware: [validationMiddleware], // Runs after authMiddleware, only for POST
          handler: async ({ request }) => {
            const body = await request.json()
            return new Response(`Hello, ${body.name}!`)
          },
        },
      }),
  },
})
```

## Handler Context

Each HTTP method handler receives an object with the following properties:

- `request`: The incoming request object. You can read more about the `Request` object in the [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Request).
- `params`: An object containing the dynamic path parameters of the route. For example, if the route path is `/users/$id`, and the request is made to `/users/123`, then `params` will be `{ id: '123' }`. We'll cover dynamic path parameters and wildcard parameters later in this guide.
- `context`: An object containing the context of the request. This is useful for passing data between middleware.

Once you've processed the request, you can return a `Response` object or `Promise<Response>` or even use any of the helpers from `@tanstack/react-start` to manipulate the response.

## Dynamic Path Params

Server routes support dynamic path parameters in the same way as TanStack Router. For example, a file named `routes/users/$id.ts` will create an API route at `/users/$id` that accepts a dynamic `id` parameter.

```ts
// routes/users/$id.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params
        return new Response(`User ID: ${id}`)
      },
    },
  },
})

// Visit /users/123 to see the response
// User ID: 123
```

You can also have multiple dynamic path parameters in a single route. For example, a file named `routes/users/$id/posts/$postId.ts` will create an API route at `/users/$id/posts/$postId` that accepts two dynamic parameters.

```ts
// routes/users/$id/posts/$postId.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$id/posts/$postId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id, postId } = params
        return new Response(`User ID: ${id}, Post ID: ${postId}`)
      },
    },
  },
})

// Visit /users/123/posts/456 to see the response
// User ID: 123, Post ID: 456
```

## Wildcard/Splat Param

Server routes also support wildcard parameters at the end of the path, which are denoted by a `$` followed by nothing. For example, a file named `routes/file/$.ts` will create an API route at `/file/$` that accepts a wildcard parameter.

```ts
// routes/file/$.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/file/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { _splat } = params
        return new Response(`File: ${_splat}`)
      },
    },
  },
})

// Visit /file/hello.txt to see the response
// File: hello.txt
```

## Handling requests with a body

To handle POST requests, you can add a `POST` handler to the route object. The handler will receive the request object as the first argument, and you can access the request body using the `request.json()` method.

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        return new Response(`Hello, ${body.name}!`)
      },
    },
  },
})

// Send a POST request to /hello with a JSON body like { "name": "Tanner" }
// Hello, Tanner!
```

This also applies to other HTTP methods like `PUT`, `PATCH`, and `DELETE`. You can add handlers for these methods in the route object and access the request body using the appropriate method.

It's important to remember that the `request.json()` method returns a `Promise` that resolves to the parsed JSON body of the request. You need to `await` the result to access the body.

This is a common pattern for handling POST requests in Server routes/ You can also use other methods like `request.text()` or `request.formData()` to access the body of the request.

## Responding with JSON

When returning JSON using a Response object, this is a common pattern:

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response(JSON.stringify({ message: 'Hello, World!' }), {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      },
    },
  },
})

// Visit /hello to see the response
// {"message":"Hello, World!"}
```

## Using the `Response.json` helper function

Or you can use the [`Response.json`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static) helper function to automatically set the `Content-Type` header to `application/json` and serialize the JSON object for you.

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return Response.json({ message: 'Hello, World!' })
      },
    },
  },
})

// Visit /hello to see the response
// {"message":"Hello, World!"}
```

## Responding with a status code

You can set the status code of the response by passing it as a property of the second argument to the `Response` constructor

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await findUser(params.id)
        if (!user) {
          return new Response('User not found', {
            status: 404,
          })
        }
        return Response.json(user)
      },
    },
  },
})
```

In this example, we're returning a `404` status code if the user is not found. You can set any valid HTTP status code using this method.

## Setting headers in the response

Sometimes you may need to set headers in the response. You can do this by passing an object as the second argument to the `Response` constructor.

```ts
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response('Hello, World!', {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      },
    },
  },
})
// Visit /hello to see the response
// Hello, World!
```
