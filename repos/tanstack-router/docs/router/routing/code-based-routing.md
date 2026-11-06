---
title: Code-Based Routing
---

> [!TIP]
> Code-based routing is not recommended for most applications. It is recommended to use [File-Based Routing](./file-based-routing.md) instead.

## ⚠️ Before You Start

- If you're using [File-Based Routing](./file-based-routing.md), **skip this guide**.
- If you still insist on using code-based routing, you must read the [Routing Concepts](./routing-concepts.md) guide first, as it also covers core concepts of the router.

## Route Trees

Code-based routing is no different from file-based routing in that it uses the same route tree concept to organize, match and compose matching routes into a component tree. The only difference is that instead of using the filesystem to organize your routes, you use code.

Let's consider the same route tree from the [Route Trees & Nesting](./route-trees.md#route-trees) guide, and convert it to code-based routing:

Here is the file-based version:

```
routes/
├── __root.tsx
├── index.tsx
├── about.tsx
├── posts/
│   ├── index.tsx
│   ├── $postId.tsx
├── posts.$postId.edit.tsx
├── settings/
│   ├── profile.tsx
│   ├── notifications.tsx
├── _pathlessLayout.tsx
├── _pathlessLayout/
│   ├── route-a.tsx
├── ├── route-b.tsx
├── files/
│   ├── $.tsx
```

And here is a summarized code-based version:

<!-- ::start:framework -->

# React

```tsx
import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'about',
})

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
})

const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '/',
})

const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
})

const postEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts/$postId/edit',
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
})

const profileRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'profile',
})

const notificationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'notifications',
})

const pathlessLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'pathlessLayout',
})

const pathlessLayoutARoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-a',
})

const pathlessLayoutBRoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-b',
})

const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'files/$',
})
```

# Solid

```tsx
import { createRootRoute, createRoute } from '@tanstack/solid-router'

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'about',
})

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
})

const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '/',
})

const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
})

const postEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts/$postId/edit',
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
})

const profileRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'profile',
})

const notificationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'notifications',
})

const pathlessLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'pathlessLayout',
})

const pathlessLayoutARoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-a',
})

const pathlessLayoutBRoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-b',
})

const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'files/$',
})
```

<!-- ::end:framework -->

## Anatomy of a Route

All other routes other than the root route are configured using the `createRoute` function:

```tsx
const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  component: PostsComponent,
})
```

The `getParentRoute` option is a function that returns the parent route of the route you're creating.

**❓❓❓ "Wait, you're making me pass the parent route for every route I make?"**

Absolutely! The reason for passing the parent route has **everything to do with the magical type safety** of TanStack Router. Without the parent route, TypeScript would have no idea what types to supply your route with!

> [!IMPORTANT]
> For every route that's **NOT** the **Root Route** or a **Pathless Layout Route**, a `path` option is required. This is the path that will be matched against the URL pathname to determine if the route is a match.

When configuring route `path` option on a route, it ignores leading and trailing slashes (this does not include "index" route paths `/`). You can include them if you want, but they will be normalized internally by TanStack Router. Here is a table of valid paths and what they will be normalized to:

| Path     | Normalized Path |
| -------- | --------------- |
| `/`      | `/`             |
| `/about` | `about`         |
| `about/` | `about`         |
| `about`  | `about`         |
| `$`      | `$`             |
| `/$`     | `$`             |
| `/$/`    | `$`             |

## Manually building the route tree

When building a route tree in code, it's not enough to define the parent route of each route. You must also construct the final route tree by adding each route to its parent route's `children` array. This is because the route tree is not built automatically for you like it is in file-based routing.

```tsx
/* prettier-ignore */
const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  postsRoute.addChildren([
    postsIndexRoute,
    postRoute,
  ]),
  postEditorRoute,
  settingsRoute.addChildren([
    profileRoute,
    notificationsRoute,
  ]),
  pathlessLayoutRoute.addChildren([
    pathlessLayoutARoute,
    pathlessLayoutBRoute,
  ]),
  filesRoute.addChildren([
    fileRoute,
  ]),
])
/* prettier-ignore-end */
```

But before you can go ahead and build the route tree, you need to understand how the Routing Concepts for Code-Based Routing work.

## Routing Concepts for Code-Based Routing

Believe it or not, file-based routing is really a superset of code-based routing and uses the filesystem and a bit of code-generation abstraction on top of it to generate this structure you see above automatically.

We're going to assume you've read the [Routing Concepts](./routing-concepts.md) guide and are familiar with each of these main concepts:

- The Root Route
- Basic Routes
- Index Routes
- Dynamic Route Segments
- Splat / Catch-All Routes
- Layout Routes
- Pathless Routes
- Non-Nested Routes

Now, let's take a look at how to create each of these route types in code.

## The Root Route

Creating a root route in code-based routing is thankfully the same as doing so in file-based routing. Call the `createRootRoute()` function.

Unlike file-based routing however, you do not need to export the root route if you don't want to. It's certainly not recommended to build an entire route tree and application in a single file (although you can and we do this in the examples to demonstrate routing concepts in brevity).

<!-- ::start:framework -->

# React

```tsx
// Standard root route
import { createRootRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

// Root route with Context
import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export interface MyRouterContext {
  queryClient: QueryClient
}
const rootRoute = createRootRouteWithContext<MyRouterContext>()
```

# Solid

```tsx
// Standard root route
import { createRootRoute } from '@tanstack/solid-router'

const rootRoute = createRootRoute()

// Root route with Context
import { createRootRouteWithContext } from '@tanstack/solid-router'
import type { QueryClient } from '@tanstack/solid-query'

export interface MyRouterContext {
  queryClient: QueryClient
}
const rootRoute = createRootRouteWithContext<MyRouterContext>()
```

<!-- ::end:framework -->

To learn more about Context in TanStack Router, see the [Router Context](../guide/router-context.md) guide.

## Basic Routes

To create a basic route, simply provide a normal `path` string to the `createRoute` function:

```tsx
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'about',
})
```

See, it's that simple! The `aboutRoute` will match the URL `/about`.

## Index Routes

Unlike file-based routing, which uses the `index` filename to denote an index route, code-based routing uses a single slash `/` to denote an index route. For example, the `posts.index.tsx` file from our example route tree above would be represented in code-based routing like this:

```tsx
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
})

const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  // Notice the single slash `/` here
  path: '/',
})
```

So, the `postsIndexRoute` will match the URL `/posts/` (or `/posts`).

## Dynamic Route Segments

Dynamic route segments work exactly the same in code-based routing as they do in file-based routing. Simply prefix a segment of the path with a `$` and it will be captured into the `params` object of the route's `loader` or `component`:

```tsx
const postIdRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
  // In a loader
  loader: ({ params }) => fetchPost(params.postId),
  // Or in a component
  component: PostComponent,
})

function PostComponent() {
  const { postId } = postIdRoute.useParams()
  return <div>Post ID: {postId}</div>
}
```

> [!TIP]
> If your component is code-split, you can use the [getRouteApi function](../guide/code-splitting.md#manually-accessing-route-apis-in-other-files-with-the-getrouteapi-helper) to avoid having to import the `postIdRoute` configuration to get access to the typed `useParams()` hook.

## Splat / Catch-All Routes

As expected, splat/catch-all routes also work the same in code-based routing as they do in file-based routing. Simply prefix a segment of the path with a `$` and it will be captured into the `params` object under the `_splat` key:

```tsx
const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'files',
})

const fileRoute = createRoute({
  getParentRoute: () => filesRoute,
  path: '$',
})
```

For the URL `/documents/hello-world`, the `params` object will look like this:

```js
{
  '_splat': 'documents/hello-world'
}
```

## Layout Routes

Layout routes are routes that wrap their children in a layout component. In code-based routing, you can create a layout route by simply nesting a route under another route:

```tsx
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
  component: PostsLayoutComponent, // The layout component
})

function PostsLayoutComponent() {
  return (
    <div>
      <h1>Posts</h1>
      <Outlet />
    </div>
  )
}

const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '/',
})

const postsCreateRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: 'create',
})

const routeTree = rootRoute.addChildren([
  // The postsRoute is the layout route
  // Its children will be nested under the PostsLayoutComponent
  postsRoute.addChildren([postsIndexRoute, postsCreateRoute]),
])
```

Now, both the `postsIndexRoute` and `postsCreateRoute` will render their contents inside of the `PostsLayoutComponent`:

```tsx
// URL: /posts
<PostsLayoutComponent>
  <PostsIndexComponent />
</PostsLayoutComponent>

// URL: /posts/create
<PostsLayoutComponent>
  <PostsCreateComponent />
</PostsLayoutComponent>
```

## Pathless Layout Routes

In file-based routing a pathless layout route is prefixed with a `_`, but in code-based routing, this is simply a route with an `id` instead of a `path` option. This is because code-based routing does not use the filesystem to organize routes, so there is no need to prefix a route with a `_` to denote that it has no path.

```tsx
const pathlessLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'pathlessLayout',
  component: PathlessLayoutComponent,
})

function PathlessLayoutComponent() {
  return (
    <div>
      <h1>Pathless Layout</h1>
      <Outlet />
    </div>
  )
}

const pathlessLayoutARoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-a',
})

const pathlessLayoutBRoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-b',
})

const routeTree = rootRoute.addChildren([
  // The pathless layout route has no path, only an id
  // So its children will be nested under the pathless layout route
  pathlessLayoutRoute.addChildren([pathlessLayoutARoute, pathlessLayoutBRoute]),
])
```

Now both `/route-a` and `/route-b` will render their contents inside of the `PathlessLayoutComponent`:

```tsx
// URL: /route-a
<PathlessLayoutComponent>
  <RouteAComponent />
</PathlessLayoutComponent>

// URL: /route-b
<PathlessLayoutComponent>
  <RouteBComponent />
</PathlessLayoutComponent>
```

## Non-Nested Routes

Building non-nested routes in code-based routing does not require using a trailing `_` in the path, but does require you to build your route and route tree with the right paths and nesting. Let's consider the route tree where we want the post editor to **not** be nested under the posts route:

- `/posts_/$postId/edit`
- `/posts`
  - `$postId`

To do this we need to build a separate route for the post editor and include the entire path in the `path` option from the root of where we want the route to be nested (in this case, the root):

```tsx
// The posts editor route is nested under the root route
const postEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  // The path includes the entire path we need to match
  path: 'posts/$postId/edit',
})

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
})

const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
})

const routeTree = rootRoute.addChildren([
  // The post editor route is nested under the root route
  postEditorRoute,
  postsRoute.addChildren([postRoute]),
])
```
