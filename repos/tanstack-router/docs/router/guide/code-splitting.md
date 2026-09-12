---
title: Code Splitting
---

Code splitting and lazy loading is a powerful technique for improving the bundle size and load performance of an application.

- Reduces the amount of code that needs to be loaded on initial page load
- Code is loaded on-demand when it is needed
- Results in more chunks that are smaller in size that can be cached more easily by the browser.

## How does TanStack Router split code?

TanStack Router separates code into two categories:

- **Critical Route Configuration** - The code that is required to render the current route and kick off the data loading process as early as possible.
  - Path Parsing/Serialization
  - Search Param Validation
  - Loaders, Before Load
  - Route Context
  - Static Data
  - Links
  - Scripts
  - Styles
  - All other route configuration not listed below

- **Non-Critical/Lazy Route Configuration** - The code that is not required to match the route, and can be loaded on-demand.
  - Route Component
  - Error Component
  - Pending Component
  - Not-found Component

> 🧠 **Why is the loader not split?**
>
> - The loader is already an asynchronous boundary, so you pay double to both get the chunk _and_ wait for the loader to execute.
> - Categorically, it is less likely to contribute to a large bundle size than a component.
> - The loader is one of the most important preloadable assets for a route, especially if you're using a default preload intent, like hovering over a link, so it's important for the loader to be available without any additional async overhead.
>
>   Knowing the disadvantages of splitting the loader, if you still want to go ahead with it, head over to the [Data Loader Splitting](#data-loader-splitting) section.

## Encapsulating a route's files into a directory

Since TanStack Router's file-based routing system is designed to support both flat and nested file structures, it's possible to encapsulate a route's files into a single directory without any additional configuration.

To encapsulate a route's files into a directory, move the route file itself into a `.route` file within a directory with the same name as the route file.

For example, if you have a route file named `posts.tsx`, you would create a new directory named `posts` and move the `posts.tsx` file into that directory, renaming it to `route.tsx`.

**Before**

- `posts.tsx`

**After**

- `posts`
  - `route.tsx`

## Approaches to code splitting

TanStack Router supports multiple approaches to code splitting. If you are using code-based routing, skip to the [Code-Based Splitting](#code-based-splitting) section.

When you are using file-based routing, you can use the following approaches to code splitting:

- [Using automatic code-splitting ✨](#using-automatic-code-splitting)
- [Using the `.lazy.tsx` suffix](#using-the-lazytsx-suffix)
- [Using Virtual Routes](#using-virtual-routes)

## Using automatic code-splitting✨

This is the easiest and most powerful way to code split your route files.

When using the `autoCodeSplitting` feature, TanStack Router will automatically code split your route files based on the non-critical route configuration mentioned above.

> [!IMPORTANT]
> The automatic code-splitting feature is **ONLY** available when you are using file-based routing with one of our [supported bundlers](../routing/file-based-routing.md#getting-started-with-file-based-routing).
> This will **NOT** work if you are **only** using the CLI (`@tanstack/router-cli`).

To enable automatic code-splitting, you just need to add the following to the configuration of your TanStack Router Bundler Plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      // ...
      autoCodeSplitting: true,
    }),
    react(), // Make sure to add this plugin after the TanStack Router Bundler plugin
  ],
})
```

That's it! TanStack Router will automatically code-split all your route files by their critical and non-critical route configurations.

If you want more control over the code-splitting process, head over to the [Automatic Code Splitting](./automatic-code-splitting.md) guide to learn more about the options available.

## Using the `.lazy.tsx` suffix

If you are not able to use the automatic code-splitting feature, you can still code-split your route files using the `.lazy.tsx` suffix. It is **as easy as moving your code into a separate file with a `.lazy.tsx` suffix** and using the `createLazyFileRoute` function instead of `createFileRoute`.

> [!IMPORTANT]
> The `__root.tsx` route file, using either `createRootRoute` or `createRootRouteWithContext`, does not support code splitting, since it's always rendered regardless of the current route.

These are the only options that `createLazyFileRoute` supports:

| Export Name         | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `component`         | The component to render for the route.                                |
| `errorComponent`    | The component to render when an error occurs while loading the route. |
| `pendingComponent`  | The component to render while the route is loading.                   |
| `notFoundComponent` | The component to render if a not-found error gets thrown.             |

### Example code splitting with `.lazy.tsx`

When you are using `.lazy.tsx` you can split your route into two files to enable code splitting:

**Before (Single File)**

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/react-router'
import { fetchPosts } from './api'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: Posts,
})

function Posts() {
  // ...
}
```

# Solid

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/solid-router'
import { fetchPosts } from './api'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: Posts,
})

function Posts() {
  // ...
}
```

<!-- ::end:framework -->

**After (Split into two files)**

This file would contain the critical route configuration:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/react-router'
import { fetchPosts } from './api'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
})
```

# Solid

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/solid-router'
import { fetchPosts } from './api'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
})
```

<!-- ::end:framework -->

With the non-critical route configuration going into the file with the `.lazy.tsx` suffix:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.lazy.tsx"
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() {
  // ...
}
```

# Solid

```tsx title="src/routes/posts.lazy.tsx"
import { createLazyFileRoute } from '@tanstack/solid-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() {
  // ...
}
```

<!-- ::end:framework -->

## Using Virtual Routes

You might run into a situation where you end up splitting out everything from a route file, leaving it empty! In this case, simply **delete the route file entirely**! A virtual route will automatically be generated for you to serve as an anchor for your code split files. This virtual route will live directly in the generated route tree file.

**Before (Virtual Routes)**

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  // Hello?
})
```

```tsx title="src/routes/posts.lazy.tsx"
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() {
  // ...
}
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/posts.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts')({
  // Hello?
})
```

```tsx title="src/routes/posts.lazy.tsx"
import { createLazyFileRoute } from '@tanstack/solid-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() {
  // ...
}
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

**After (Virtual Routes)**

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.lazy.tsx"
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() {
  // ...
}
```

# Solid

```tsx title="src/routes/posts.lazy.tsx"
import { createLazyFileRoute } from '@tanstack/solid-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() {
  // ...
}
```

<!-- ::end:framework -->

Tada! 🎉

## Code-Based Splitting

If you are using code-based routing, you can still code-split your routes using the `Route.lazy()` method and the `createLazyRoute` function. You'll need to split your route configuration into two parts:

Create a lazy route using the `createLazyRoute` function.

```tsx title="src/posts.lazy.tsx"
export const Route = createLazyRoute('/posts')({
  component: MyComponent,
})

function MyComponent() {
  return <div>My Component</div>
}
```

Then, call the `.lazy` method on the route definition in your `app.tsx` to import the lazy/code-split route with the non-critical route configuration.

```tsx title="src/app.tsx"
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
}).lazy(() => import('./posts.lazy').then((d) => d.Route))
```

## Data Loader Splitting

**Be warned!!!** Splitting a route loader is a dangerous game.

It can be a powerful tool to reduce bundle size, but it comes with a cost as mentioned in the [How does TanStack Router split code?](#how-does-tanstack-router-split-code) section.

You can code split your data loading logic using the Route's `loader` option. While this process makes it difficult to maintain type-safety with the parameters passed to your loader, you can always use the generic `LoaderContext` type to get you most of the way there:

<!-- ::start:framework -->

# React

```tsx
import { lazyFn } from '@tanstack/react-router'

const route = createRoute({
  path: '/my-route',
  component: MyComponent,
  loader: lazyFn(() => import('./loader'), 'loader'),
})

// In another file...a
export const loader = async (context: LoaderContext) => {
  /// ...
}
```

# Solid

```tsx
import { lazyFn } from '@tanstack/solid-router'

const route = createRoute({
  path: '/my-route',
  component: MyComponent,
  loader: lazyFn(() => import('./loader'), 'loader'),
})

// In another file...a
export const loader = async (context: LoaderContext) => {
  /// ...
}
```

<!-- ::end:framework -->

If you are using file-based routing, you'll only be able to split your `loader` if you are using [Automatic Code Splitting](#using-automatic-code-splitting) with customized bundling options.

## Manually accessing Route APIs in other files with the `getRouteApi` helper

As you might have guessed, placing your component code in a separate file than your route can make it difficult to consume the route itself. To help with this, TanStack Router exports a handy `getRouteApi` function that you can use to access a route's type-safe APIs in a file without importing the route itself.

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title="src/my-route.tsx"
import { createRoute } from '@tanstack/react-router'
import { MyComponent } from './MyComponent'

const route = createRoute({
  path: '/my-route',
  loader: () => ({
    foo: 'bar',
  }),
  component: MyComponent,
})
```

```tsx title="src/MyComponent.tsx"
import { getRouteApi } from '@tanstack/react-router'

const route = getRouteApi('/my-route')

export function MyComponent() {
  const loaderData = route.useLoaderData()
  //    ^? { foo: string }

  return <div>...</div>
}
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title="src/my-route.tsx"
import { createRoute } from '@tanstack/solid-router'
import { MyComponent } from './MyComponent'

const route = createRoute({
  path: '/my-route',
  loader: () => ({
    foo: 'bar',
  }),
  component: MyComponent,
})
```

```tsx title="src/MyComponent.tsx"
import { getRouteApi } from '@tanstack/solid-router'

const route = getRouteApi('/my-route')

export function MyComponent() {
  const loaderData = route.useLoaderData()
  //    ^? { foo: string }

  return <div>...</div>
}
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

The `getRouteApi` function is useful for accessing other type-safe APIs:

- `useLoaderData`
- `useLoaderDeps`
- `useMatch`
- `useParams`
- `useRouteContext`
- `useSearch`
