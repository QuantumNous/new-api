---
title: Not Found Errors
---

> ⚠️ This page covers the newer `notFound` function and `notFoundComponent` API for handling not found errors. The `NotFoundRoute` route is deprecated and will be removed in a future release. See [Migrating from `NotFoundRoute`](#migrating-from-notfoundroute) for more information.

## Overview

There are 2 uses for not-found errors in TanStack Router:

- **Non-matching route paths**: When a path does not match any known route matching pattern **OR** when it partially matches a route, but with extra path segments
  - The **router** will automatically throw a not-found error when a path does not match any known route matching pattern
  - If the router's `notFoundMode` is set to `fuzzy`, the nearest matching route with a `notFoundComponent` will handle the error. If the router's `notFoundMode` is set to `root`, the root route will handle the error.
  - Examples:
    - Attempting to access `/users` when there is no `/users` route
    - Attempting to access `/posts/1/edit` when the route tree only handles `/posts/$postId`
- **Missing resources**: When a resource cannot be found, such as a post with a given ID or any asynchronous data that is not available or does not exist
  - **You, the developer** must throw a not-found error when a resource cannot be found. This can be done in the `beforeLoad` or `loader` functions using the `notFound` utility.
  - Will be handled by the nearest matching route with a `notFoundComponent` (when `notFound` is called within `loader`) or the root route.
  - Examples:
    - Attempting to access `/posts/1` when the post with ID 1 does not exist
    - Attempting to access `/docs/path/to/document` when the document does not exist

Under the hood, both of these cases are implemented using the same `notFound` function and `notFoundComponent` API.

## The `notFoundMode` option

When TanStack Router encounters a **pathname** that doesn't match any known route pattern **OR** partially matches a route pattern but with extra trailing pathname segments, it will automatically throw a not-found error.

Depending on the `notFoundMode` option, the router will handle these automatic errors differently:

- ["fuzzy" mode](#notfoundmode-fuzzy) (default): The router will intelligently find the closest matching suitable route and display the `notFoundComponent`.
- ["root" mode](#notfoundmode-root): All not-found errors will be handled by the root route's `notFoundComponent`, regardless of the nearest matching route.

### `notFoundMode: 'fuzzy'`

By default, the router's `notFoundMode` is set to `fuzzy`, which indicates that if a pathname doesn't match any known route, the router will attempt to use the closest matching route with a configured `notFoundComponent`.

> **❓ Why is this the default?** Fuzzy matching to preserve as much parent layout as possible for the user gives them more context to navigate to a useful location based on where they thought they would arrive.

The nearest suitable route is found using the following criteria:

- The route must have a `notFoundComponent` configured or the router must have a `defaultNotFoundComponent` configured

For example, consider the following route tree:

- `__root__` (has a `notFoundComponent` configured)
  - `posts` (has a `notFoundComponent` configured)
    - `$postId` (has a `notFoundComponent` configured)

If provided the path of `/posts/1/edit`, the following component structure will be rendered:

- `<Root>`
  - `<Posts>`
    - `<Post>`
      - `<Post.notFoundComponent>`

The `notFoundComponent` of the `$postId` route will be rendered because it is the **nearest matching route with a `notFoundComponent` configured**.

### `notFoundMode: 'root'`

When `notFoundMode` is set to `root`, all not-found errors will be handled by the root route's `notFoundComponent` instead of bubbling up from the nearest fuzzy-matched route.

For example, consider the following route tree:

- `__root__` (has a `notFoundComponent` configured)
  - `posts` (has a `notFoundComponent` configured)
    - `$postId` (has a `notFoundComponent` configured)

If provided the path of `/posts/1/edit`, the following component structure will be rendered:

- `<Root>`
  - `<Root.notFoundComponent>`

The `notFoundComponent` of the `__root__` route will be rendered because the `notFoundMode` is set to `root`.

## Configuring a route's `notFoundComponent`

To handle both types of not-found errors, you can attach a `notFoundComponent` to a route. This component will be rendered when a not-found error is thrown.

For example, configuring a `notFoundComponent` for a `/settings` route to handle non-existing settings pages:

```tsx
export const Route = createFileRoute('/settings')({
  component: () => {
    return (
      <div>
        <p>Settings page</p>
        <Outlet />
      </div>
    )
  },
  notFoundComponent: () => {
    return <p>This setting page doesn't exist!</p>
  },
})
```

Or configuring a `notFoundComponent` for a `/posts/$postId` route to handle posts that don't exist:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await getPost(postId)
    if (!post) throw notFound()
    return { post }
  },
  component: ({ post }) => {
    return (
      <div>
        <h1>{post.title}</h1>
        <p>{post.body}</p>
      </div>
    )
  },
  notFoundComponent: () => {
    return <p>Post not found!</p>
  },
})
```

## Default Router-Wide Not Found Handling

You may want to provide a default not-found component for every route in your app with child routes.

> Why only routes with children? **Leaf-node routes (routes without children) will never render an `Outlet` and therefore are not able to handle not-found errors.**

To do this, pass a `defaultNotFoundComponent` to the `createRouter` function:

```tsx
const router = createRouter({
  defaultNotFoundComponent: () => {
    return (
      <div>
        <p>Not found!</p>
        <Link to="/">Go home</Link>
      </div>
    )
  },
})
```

## Throwing your own `notFound` errors

You can manually throw not-found errors in loader methods and components using the `notFound` function. This is useful when you need to signal that a resource cannot be found.

The `notFound` function works in a similar fashion to the `redirect` function. To cause a not-found error, you can **throw a `notFound()`**.

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    // Returns `null` if the post doesn't exist
    const post = await getPost(postId)
    if (!post) {
      throw notFound()
      // Alternatively, you can make the notFound function throw:
      // notFound({ throw: true })
    }
    // Post is guaranteed to be defined here because we threw an error
    return { post }
  },
})
```

The not-found error above will be handled by the same route or nearest parent route that has either a `notFoundComponent` route option or the `defaultNotFoundComponent` router option configured.

If neither the route nor any suitable parent route is found to handle the error, the root route will handle it using TanStack Router's **extremely basic (and purposefully undesirable)** default not-found component that simply renders `<p>Not Found</p>`. It's highly recommended to either attach at least one `notFoundComponent` to the root route or configure a router-wide `defaultNotFoundComponent` to handle not-found errors.

> ⚠️ When you throw `notFound()` in `beforeLoad`, TanStack Router resolves it the same way as other not-found errors:
>
> - If you pass `routeId`, that route (or the nearest valid ancestor boundary) handles it.
> - If you don't pass `routeId`, the nearest route/ancestor with a `notFoundComponent` handles it (based on the router's mode and matching rules).
> - If no suitable boundary is found, handling falls back to the root/default not-found behavior.
>
> For `beforeLoad`-thrown not-found errors, TanStack Router still runs required parent loaders so the selected not-found boundary can render with the loader data it depends on.

## Specifying Which Routes Handle Not Found Errors

Sometimes you may want to trigger a not-found on a specific parent route and bypass the normal not-found component propagation. To do this, pass in a route id to the `route` option in the `notFound` function.

```tsx
// _pathlessLayout.tsx
export const Route = createFileRoute('/_pathlessLayout')({
  // This will render
  notFoundComponent: () => {
    return <p>Not found (in _pathlessLayout)</p>
  },
  component: () => {
    return (
      <div>
        <p>This is a pathless layout route!</p>
        <Outlet />
      </div>
    )
  },
})

// _pathlessLayout/route-a.tsx
export const Route = createFileRoute('/_pathless/route-a')({
  loader: async () => {
    // This will make LayoutRoute handle the not-found error
    throw notFound({ routeId: '/_pathlessLayout' })
    //                      ^^^^^^^^^ This will autocomplete from the registered router
  },
  // This WILL NOT render
  notFoundComponent: () => {
    return <p>Not found (in _pathlessLayout/route-a)</p>
  },
})
```

### Manually targeting the root route

You can also target the root route by passing the exported `rootRouteId` variable to the `notFound` function's `route` property:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await getPost(postId)
    if (!post) throw notFound({ routeId: rootRouteId })
    return { post }
  },
})
```

### Throwing Not Found Errors in Components

You can also throw not-found errors in components. However, **it is recommended to throw not-found errors in loader methods instead of components in order to correctly type loader data and prevent flickering.**

TanStack Router exposes a `CatchNotFound` component similar to `CatchBoundary` that can be used to catch not-found errors in components and display UI accordingly.

### Data Loading Inside `notFoundComponent`

`notFoundComponent` is a special case when it comes to data loading. **`SomeRoute.useLoaderData` may not be defined depending on which route you are trying to access and where the not-found error gets thrown**. However, `Route.useParams`, `Route.useSearch`, `Route.useRouteContext`, etc. will return a defined value.

**If you need to pass incomplete loader data to `notFoundComponent`,** pass the data via the `data` option in the `notFound` function and validate it in `notFoundComponent`.

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await getPost(postId)
    if (!post)
      throw notFound({
        // Forward some data to the notFoundComponent
        // data: someIncompleteLoaderData
      })
    return { post }
  },
  // `data: unknown` is passed to the component via the `data` option when calling `notFound`
  notFoundComponent: ({ data }) => {
    // ❌ useLoaderData is not valid here: const { post } = Route.useLoaderData()

    // ✅:
    const { postId } = Route.useParams()
    const search = Route.useSearch()
    const context = Route.useRouteContext()

    return <p>Post with id {postId} not found!</p>
  },
})
```

## Usage With SSR

See [SSR guide](./ssr.md) for more information.

## Migrating from `NotFoundRoute`

The `NotFoundRoute` API is deprecated in favor of `notFoundComponent`. The `NotFoundRoute` API will be removed in a future release.

**The `notFound` function and `notFoundComponent` will not work when using `NotFoundRoute`.**

The main differences are:

- `NotFoundRoute` is a route that requires an `<Outlet>` on its parent route to render. `notFoundComponent` is a component that can be attached to any route.
- When using `NotFoundRoute`, you can't use layouts. `notFoundComponent` can be used with layouts.
- When using `notFoundComponent`, path matching is strict. This means that if you have a route at `/post/$postId`, a not-found error will be thrown if you try to access `/post/1/2/3`. With `NotFoundRoute`, `/post/1/2/3` would match the `NotFoundRoute` and only render it if there is an `<Outlet>`.

To migrate from `NotFoundRoute` to `notFoundComponent`, you'll just need to make a few changes:

```tsx title='src/router.tsx'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.'
- import { notFoundRoute } from './notFoundRoute'  // [!code --]

export const router = createRouter({
  routeTree,
- notFoundRoute // [!code --]
})

// routes/__root.tsx
import { createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  // ...
+ notFoundComponent: () => {  // [!code ++]
+   return <p>Not found!</p>  // [!code ++]
+ } // [!code ++]
})
```

Important changes:

- A `notFoundComponent` is added to the root route for global not-found handling.
  - You can also add a `notFoundComponent` to any other route in your route tree to handle not-found errors for that specific route.
- The `notFoundComponent` does not support rendering an `<Outlet>`.
