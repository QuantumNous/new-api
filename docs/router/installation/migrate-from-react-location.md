---
title: Migration from React Location
---

Before you begin your journey in migrating from React Location, it's important that you have a good understanding of the [Routing Concepts](../routing/routing-concepts.md) and [Design Decisions](../decisions-on-dx.md) used by TanStack Router.

## Differences between React Location and TanStack Router

React Location and TanStack Router share much of same design decisions concepts, but there are some key differences that you should be aware of.

- React Location uses _generics_ to infer types for routes, while TanStack Router uses _module declaration merging_ to infer types.
- Route configuration in React Location is done using a single array of route definitions, while in TanStack Router, route configuration is done using a tree of route definitions starting with the [root route](../routing/routing-concepts.md#the-root-route).
- [File-based routing](../routing/file-based-routing.md) is the recommended way to define routes in TanStack Router, while React Location only allows you to define routes in a single file using a code-based approach.
  - TanStack Router does support a [code-based approach](../routing/code-based-routing.md) to defining routes, but it is not recommended for most use cases. You can read more about why, over here: [why is file-based routing the preferred way to define routes?](../decisions-on-dx.md#why-is-file-based-routing-the-preferred-way-to-define-routes)

## Migration guide

In this guide we'll go over the process of migrating the [React Location Basic example](https://github.com/TanStack/router/tree/react-location/examples/basic) over to TanStack Router using file-based routing, with the end goal of having the same functionality as the original example (styling and other non-routing related code will be omitted).

> [!TIP]
> To use a code-based approach for defining your routes, you can read the [code-based Routing](../routing/code-based-routing.md) guide.

### Step 1: Swap over to TanStack Router's dependencies

First, we need to install the dependencies for TanStack Router. For detailed installation instructions, see our [How to Install TanStack Router](../how-to/install.md) guide.

```sh
npm install @tanstack/react-router @tanstack/router-devtools
```

And remove the React Location dependencies.

```sh
npm uninstall @tanstack/react-location @tanstack/react-location-devtools
```

### Step 2: Use the file-based routing watcher

If your project uses Vite (or one of the supported bundlers), you can use the TanStack Router plugin to watch for changes in your routes files and automatically update the routes configuration.

Installation of the Vite plugin:

```sh
npm install -D @tanstack/router-plugin
```

And add it to your `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  // ...
  plugins: [tanstackRouter(), react()],
})
```

However, if your application does not use Vite, you use one of our other [supported bundlers](../routing/file-based-routing.md#getting-started-with-file-based-routing), or you can use the `@tanstack/router-cli` package to watch for changes in your routes files and automatically update the routes configuration.

### Step 3: Add the file-based configuration file to your project

Create a `tsr.config.json` file in the root of your project with the following content:

```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts"
}
```

You can find the full list of options for the `tsr.config.json` file in the [File-Based Routing](../routing/file-based-routing.md) guide.

### Step 4: Create the routes directory

Create a `routes` directory in the `src` directory of your project.

```sh
mkdir src/routes
```

### Step 5: Create the root route file

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: () => {
    return (
      <>
        <div>
          <Link to="/" activeOptions={{ exact: true }}>
            Home
          </Link>
          <Link to="/posts">Posts</Link>
        </div>
        <hr />
        <Outlet />
        <TanStackRouterDevtools />
      </>
    )
  },
})
```

### Step 6: Create the index route file

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})
```

> You will need to move any related components and logic needed for the index route from the `src/index.tsx` file to the `src/routes/index.tsx` file.

### Step 7: Create the posts route file

```tsx
// src/routes/posts.tsx
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  component: Posts,
  loader: async () => {
    const posts = await fetchPosts()
    return {
      posts,
    }
  },
})

function Posts() {
  const { posts } = Route.useLoaderData()
  return (
    <div>
      <nav>
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/posts/$postId`}
            params={{ postId: post.id }}
          >
            {post.title}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
```

> You will need to move any related components and logic needed for the posts route from the `src/index.tsx` file to the `src/routes/posts.tsx` file.

### Step 8: Create the posts index route file

```tsx
// src/routes/posts.index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/')({
  component: PostsIndex,
})
```

> You will need to move any related components and logic needed for the posts index route from the `src/index.tsx` file to the `src/routes/posts.index.tsx` file.

### Step 9: Create the posts id route file

```tsx
// src/routes/posts.$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  component: PostsId,
  loader: async ({ params: { postId } }) => {
    const post = await fetchPost(postId)
    return {
      post,
    }
  },
})

function PostsId() {
  const { post } = Route.useLoaderData()
  // ...
}
```

> You will need to move any related components and logic needed for the posts id route from the `src/index.tsx` file to the `src/routes/posts.$postId.tsx` file.

### Step 10: Generate the route tree

If you are using one of the supported bundlers, the route tree will be generated automatically when you run the dev script.

If you are not using one of the supported bundlers, you can generate the route tree by running the following command:

```sh
npx tsr generate
```

### Step 11: Update the main entry file to render the Router

Once you've generated the route-tree, you can then update the `src/index.tsx` file to create the router instance and render it.

```tsx
// src/index.tsx
import React from 'react'
import ReactDOM from 'react-dom'
import { createRouter, RouterProvider } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const domElementId = 'root' // Assuming you have a root element with the id 'root'

// Render the app
const rootElement = document.getElementById(domElementId)
if (!rootElement) {
  throw new Error(`Element with id ${domElementId} not found`)
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

### Finished!

You should now have successfully migrated your application from React Location to TanStack Router using file-based routing.

React Location also has a few more features that you might be using in your application. Here are some guides to help you migrate those features:

- [Search params](../guide/search-params.md)
- [Data loading](../guide/data-loading.md)
- [History types](../guide/history-types.md)
- [Wildcard / Splat / Catch-all routes](../routing/routing-concepts.md#splat--catch-all-routes)
- [Authenticated routes](../guide/authenticated-routes.md)

TanStack Router also has a few more features that you might want to explore:

- [Router Context](../guide/router-context.md)
- [Preloading](../guide/preloading.md)
- [Pathless Layout Routes](../routing/routing-concepts.md#pathless-layout-routes)
- [Route masking](../guide/route-masking.md)
- [SSR](../guide/ssr.md)
- ... and more!

If you are facing any issues or have any questions, feel free to ask for help in the TanStack Discord.
