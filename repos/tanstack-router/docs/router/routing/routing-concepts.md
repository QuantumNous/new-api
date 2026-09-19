---
title: Routing Concepts
---

TanStack Router supports a number of powerful routing concepts that allow you to build complex and dynamic routing systems with ease.

Each of these concepts is useful and powerful, and we'll dive into each of them in the following sections.

## Anatomy of a Route

All other routes, other than the [Root Route](#the-root-route), are configured using the `createFileRoute` function, which provides type safety when using file-based routing:

<!-- ::start:framework -->

# React

```tsx title="src/routes/index.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: PostsComponent,
})
```

# Solid

```tsx title="src/routes/index.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: PostsComponent,
})
```

<!-- ::end:framework -->

The `createFileRoute` function takes a single argument, the file-route's path as a string.

**❓❓❓ "Wait, you're making me pass the path of the route file to `createFileRoute`?"**

Yes! But don't worry, this path is **automatically written and managed by the router for you via the TanStack Router Bundler Plugin or Router CLI.** So, as you create new routes, move routes around or rename routes, the path will be updated for you automatically.

The reason for this pathname has everything to do with the magical type safety of TanStack Router. Without this pathname, TypeScript would have no idea what file we're in! (We wish TypeScript had a built-in for this, but they don't yet 🤷‍♂️)

## The Root Route

The root route is the top-most route in the entire tree and encapsulates all other routes as children.

- It has no path
- It is **always** matched
- Its `component` is **always** rendered

Even though it doesn't have a path, the root route has access to all of the same functionality as other routes including:

- components
- loaders
- search param validation
- etc.

To create a root route, call the `createRootRoute()` function and export it as the `Route` variable in your route file:

<!-- ::start:framework -->

# React

```tsx
// Standard root route
import { createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute()

// Root route with Context
import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export interface MyRouterContext {
  queryClient: QueryClient
}
export const Route = createRootRouteWithContext<MyRouterContext>()
```

# Solid

```tsx
// Standard root route
import { createRootRoute } from '@tanstack/solid-router'

export const Route = createRootRoute()

// Root route with Context
import { createRootRouteWithContext } from '@tanstack/solid-router'
import type { QueryClient } from '@tanstack/solid-query'

export interface MyRouterContext {
  queryClient: QueryClient
}
export const Route = createRootRouteWithContext<MyRouterContext>()
```

<!-- ::end:framework -->

To learn more about Context in TanStack Router, see the [Router Context](../guide/router-context.md) guide.

## Basic Routes

Basic routes match a specific path, for example `/about`, `/settings`, `/settings/notifications` are all basic routes, as they match the path exactly.

Let's take a look at an `/about` route:

<!-- ::start:framework -->

# React

```tsx title="src/routes/about.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return <div>About</div>
}
```

# Solid

```tsx title="src/routes/about.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return <div>About</div>
}
```

<!-- ::end:framework -->

Basic routes are simple and straightforward. They match the path exactly and render the provided component.

## Index Routes

Index routes specifically target their parent route when it is **matched exactly and no child route is matched**.

Let's take a look at an index route for a `/posts` URL:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.index.tsx"
import { createFileRoute } from '@tanstack/react-router'

// Note the trailing slash, which is used to target index routes
export const Route = createFileRoute('/posts/')({
  component: PostsIndexComponent,
})

function PostsIndexComponent() {
  return <div>Please select a post!</div>
}
```

# Solid

```tsx title="src/routes/posts.index.tsx"
import { createFileRoute } from '@tanstack/solid-router'

// Note the trailing slash, which is used to target index routes
export const Route = createFileRoute('/posts/')({
  component: PostsIndexComponent,
})

function PostsIndexComponent() {
  return <div>Please select a post!</div>
}
```

<!-- ::end:framework -->

This route will be matched when the URL is `/posts` exactly.

## Dynamic Route Segments

Route path segments that start with a `$` followed by a label are dynamic and capture that section of the URL into the `params` object for use in your application. For example, a pathname of `/posts/123` would match the `/posts/$postId` route, and the `params` object would be `{ postId: '123' }`.

These params are then usable in your route's configuration and components! Let's look at a `posts.$postId.tsx` route:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts/$postId.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  // In a loader
  loader: ({ params }) => fetchPost(params.postId),
  // Or in a component
  component: PostComponent,
})

function PostComponent() {
  // In a component!
  const { postId } = Route.useParams()
  return <div>Post ID: {postId}</div>
}
```

# Solid

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts/$postId')({
  // In a loader
  loader: ({ params }) => fetchPost(params.postId),
  // Or in a component
  component: PostComponent,
})

function PostComponent() {
  // In a component!
  const { postId } = Route.useParams()
  return <div>Post ID: {postId()}</div>
}
```

<!-- ::end:framework -->

> 🧠 Dynamic segments work at **each** segment of the path. For example, you could have a route with the path of `/posts/$postId/$revisionId` and each `$` segment would be captured into the `params` object.

## Splat / Catch-All Routes

A route with a path of only `$` is called a "splat" route because it _always_ captures _any_ remaining section of the URL pathname from the `$` to the end. The captured pathname is then available in the `params` object under the special `_splat` property.

For example, a route targeting the `files/$` path is a splat route. If the URL pathname is `/files/documents/hello-world`, the `params` object would contain `documents/hello-world` under the special `_splat` property:

```js
{
  '_splat': 'documents/hello-world'
}
```

> ⚠️ In v1 of the router, splat routes are also denoted with a `*` instead of a `_splat` key for backwards compatibility. This will be removed in v2.

> 🧠 Why use `$`? Thanks to tools like Remix, we know that despite `*`s being the most common character to represent a wildcard, they do not play nice with filenames or CLI tools, so just like them, we decided to use `$` instead.

## Optional Path Parameters

Optional path parameters allow you to define route segments that may or may not be present in the URL. They use the `{-$paramName}` syntax and provide flexible routing patterns where certain parameters are optional.

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.{-$category}.tsx"
// The `-$category` segment is optional, so this route matches both `/posts` and `/posts/tech`
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/{-$category}')({
  component: PostsComponent,
})

function PostsComponent() {
  const { category } = Route.useParams()

  return <div>{category ? `Posts in ${category}` : 'All Posts'}</div>
}
```

# Solid

```tsx title="src/routes/posts.{-$category}.tsx"
// The `-$category` segment is optional, so this route matches both `/posts` and `/posts/tech`
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts/{-$category}')({
  component: PostsComponent,
})

function PostsComponent() {
  const { category } = Route.useParams()

  return <div>{category ? `Posts in ${category()}` : 'All Posts'}</div>
}
```

<!-- ::end:framework -->

This route will match both `/posts` (category is `undefined`) and `/posts/tech` (category is `"tech"`).

You can also define multiple optional parameters in a single route:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.{-$category}.${-$slug}.tsx"
// The `-$category` segment is optional, so this route matches both `/posts` and `/posts/tech`
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/{-$category}/{-$slug}')({
  component: PostsComponent,
})
```

# Solid

```tsx title="src/routes/posts.{-$category}.${-$slug}.tsx"
// The `-$category` segment is optional, so this route matches both `/posts` and `/posts/tech`
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts/{-$category}/{-$slug}')({
  component: PostsComponent,
})
```

<!-- ::end:framework -->

This route matches `/posts`, `/posts/tech`, and `/posts/tech/hello-world`.

> 🧠 Routes with optional parameters are ranked lower in priority than exact matches, ensuring that more specific routes like `/posts/featured` are matched before `/posts/{-$category}`.

## Layout Routes

Layout routes are used to wrap child routes with additional components and logic. They are useful for:

- Wrapping child routes with a layout component
- Enforcing a `loader` requirement before displaying any child routes
- Validating and providing search params to child routes
- Providing fallbacks for error components or pending elements to child routes
- Providing shared context to all child routes
- And more!

Let's take a look at an example layout route called `app.tsx`:

```
routes/
├── app.tsx
├── app.dashboard.tsx
├── app.settings.tsx
```

In the tree above, `app.tsx` is a layout route that wraps two child routes, `app.dashboard.tsx` and `app.settings.tsx`.

This tree structure is used to wrap the child routes with a layout component:

<!-- ::start:framework -->

# React

```tsx title="src/routes/app.tsx"
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  component: AppLayoutComponent,
})

function AppLayoutComponent() {
  return (
    <div>
      <h1>App Layout</h1>
      <Outlet />
    </div>
  )
}
```

# Solid

```tsx title="src/routes/app.tsx"
import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/app')({
  component: AppLayoutComponent,
})

function AppLayoutComponent() {
  return (
    <div>
      <h1>App Layout</h1>
      <Outlet />
    </div>
  )
}
```

<!-- ::end:framework -->

The following table shows which component(s) will be rendered based on the URL:

| URL Path         | Component                |
| ---------------- | ------------------------ |
| `/app`           | `<AppLayout>`            |
| `/app/dashboard` | `<AppLayout><Dashboard>` |
| `/app/settings`  | `<AppLayout><Settings>`  |

Since TanStack Router supports mixed flat and directory routes, you can also express your application's routing using layout routes within directories:

```
routes/
├── app/
│   ├── route.tsx
│   ├── dashboard.tsx
│   ├── settings.tsx
```

In this nested tree, the `app/route.tsx` file is a configuration for the layout route that wraps two child routes, `app/dashboard.tsx` and `app/settings.tsx`.

Layout Routes also let you enforce component and loader logic for Dynamic Route Segments:

```
routes/
├── app/users/
│   ├── $userId/
|   |   ├── route.tsx
|   |   ├── index.tsx
|   |   ├── edit.tsx
```

## Pathless Layout Routes

Like [Layout Routes](#layout-routes), Pathless Layout Routes are used to wrap child routes with additional components and logic. However, pathless layout routes do not require a matching `path` in the URL and are used to wrap child routes with additional components and logic without requiring a matching `path` in the URL.

Pathless Layout Routes are prefixed with an underscore (`_`) to denote that they are "pathless".

> 🧠 The part of the path after the `_` prefix is used as the route's ID and is required because every route must be uniquely identifiable, especially when using TypeScript so as to avoid type errors and accomplish autocomplete effectively.

Let's take a look at an example route called `_pathlessLayout.tsx`:

```

routes/
├── _pathlessLayout.tsx
├── _pathlessLayout.a.tsx
├── _pathlessLayout.b.tsx

```

In the tree above, `_pathlessLayout.tsx` is a pathless layout route that wraps two child routes, `_pathlessLayout.a.tsx` and `_pathlessLayout.b.tsx`.

The `_pathlessLayout.tsx` route is used to wrap the child routes with a Pathless layout component:

<!-- ::start:framework -->

# React

```tsx title="src/routes/_pathlessLayout.tsx"
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_pathlessLayout')({
  component: PathlessLayoutComponent,
})

function PathlessLayoutComponent() {
  return (
    <div>
      <h1>Pathless layout</h1>
      <Outlet />
    </div>
  )
}
```

# Solid

```tsx title="src/routes/_pathlessLayout.tsx"
import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/_pathlessLayout')({
  component: PathlessLayoutComponent,
})

function PathlessLayoutComponent() {
  return (
    <div>
      <h1>Pathless layout</h1>
      <Outlet />
    </div>
  )
}
```

<!-- ::end:framework -->

The following table shows which component will be rendered based on the URL:

| URL Path | Component             |
| -------- | --------------------- |
| `/`      | `<Index>`             |
| `/a`     | `<PathlessLayout><A>` |
| `/b`     | `<PathlessLayout><B>` |

Since TanStack Router supports mixed flat and directory routes, you can also express your application's routing using pathless layout routes within directories:

```
routes/
├── _pathlessLayout/
│   ├── route.tsx
│   ├── a.tsx
│   ├── b.tsx
```

However, unlike Layout Routes, since Pathless Layout Routes do not match based on URL path segments, this means that these routes do not support [Dynamic Route Segments](#dynamic-route-segments) as part of their path and therefore cannot be matched in the URL.

This means that you cannot do this:

```
routes/
├── _$postId/ ❌
│   ├── ...
```

Rather, you'd have to do this:

```
routes/
├── $postId/
├── _postPathlessLayout/ ✅
│   ├── ...
```

## Non-Nested Routes

Non-nested routes can be created by suffixing a parent file route segment with a `_` and are used to **un-nest** a route from its parents and render its own component tree.

Consider the following flat route tree:

```
routes/
├── posts.tsx
├── posts.$postId.tsx
├── posts_.$postId.edit.tsx
```

The following table shows which component will be rendered based on the URL:

| URL Path          | Component                    |
| ----------------- | ---------------------------- |
| `/posts`          | `<Posts>`                    |
| `/posts/123`      | `<Posts><Post postId="123">` |
| `/posts/123/edit` | `<PostEditor postId="123">`  |

- The `posts.$postId.tsx` route is nested as normal under the `posts.tsx` route and will render `<Posts><Post>`.
- The `posts_.$postId.edit.tsx` route **does not share** the same `posts` prefix as the other routes and therefore will be treated as if it is a top-level route and will render `<PostEditor>`.

## Excluding Files and Folders from Routes

Files and folders can be excluded from route generation with a `-` prefix attached to the file name. This gives you the ability to colocate logic in the route directories.

Consider the following route tree:

```
routes/
├── posts.tsx
├── -posts-table.tsx // 👈🏼 ignored
├── -components/ // 👈🏼 ignored
│   ├── header.tsx // 👈🏼 ignored
│   ├── footer.tsx // 👈🏼 ignored
│   ├── ...
```

We can import from the excluded files into our posts route

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/react-router'
import { PostsTable } from './-posts-table'
import { PostsHeader } from './-components/header'
import { PostsFooter } from './-components/footer'

export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  component: PostComponent,
})

function PostComponent() {
  const posts = Route.useLoaderData()

  return (
    <div>
      <PostsHeader />
      <PostsTable posts={posts} />
      <PostsFooter />
    </div>
  )
}
```

# Solid

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/solid-router'
import { PostsTable } from './-posts-table'
import { PostsHeader } from './-components/header'
import { PostsFooter } from './-components/footer'

export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  component: PostComponent,
})

function PostComponent() {
  const posts = Route.useLoaderData()

  return (
    <div>
      <PostsHeader />
      <PostsTable posts={posts} />
      <PostsFooter />
    </div>
  )
}
```

<!-- ::end:framework -->

The excluded files will not be added to `routeTree.gen.ts`.

## Pathless Route Group Directories

Pathless route group directories use `()` as a way to group routes files together regardless of their path. They are purely organizational and do not affect the route tree or component tree in any way.

```
routes/
├── index.tsx
├── (app)/
│   ├── dashboard.tsx
│   ├── settings.tsx
│   ├── users.tsx
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
```

In the example above, the `app` and `auth` directories are purely organizational and do not affect the route tree or component tree in any way. They are used to group related routes together for easier navigation and organization.

The following table shows which component will be rendered based on the URL:

| URL Path     | Component     |
| ------------ | ------------- |
| `/`          | `<Index>`     |
| `/dashboard` | `<Dashboard>` |
| `/settings`  | `<Settings>`  |
| `/users`     | `<Users>`     |
| `/login`     | `<Login>`     |
| `/register`  | `<Register>`  |

As you can see, the `app` and `auth` directories are purely organizational and do not affect the route tree or component tree in any way.
