---
id: data-loading
title: Data Loading
---

Data loading is a common concern for web applications and is related to routing. When loading a page for your app, it's ideal if all of the page's async requirements are fetched and fulfilled as early as possible, in parallel. The router is the best place to coordinate these async dependencies as it's usually the only place in your app that knows where users are headed before content is rendered.

You may be familiar with `getServerSideProps` from Next.js or `loader`s from Remix/React-Router. TanStack Router has similar functionality to preload/load assets on a per-route basis in parallel allowing it to render as quickly as possible as it fetches via suspense.

Beyond these normal expectations of a router, TanStack Router goes above and beyond and provides **built-in SWR Caching**, a long-term in-memory caching layer for route loaders. This means that you can use TanStack Router to both preload data for your routes so they load instantaneously or temporarily cache route data for previously visited routes to use again later.

## The route loading lifecycle

Every time a URL/history update is detected, the router executes the following sequence:

- Route Matching (Top-Down)
  - `route.params.parse`
  - `route.validateSearch`
- Route Pre-Loading (Serial)
  - `route.beforeLoad`
  - `route.onError`
    - `route.errorComponent` / `parentRoute.errorComponent` / `router.defaultErrorComponent`
- Route Loading (Parallel)
  - `route.component.preload?`
  - `route.loader`
    - `route.pendingComponent` (Optional)
    - `route.component`
  - `route.onError`
    - `route.errorComponent` / `parentRoute.errorComponent` / `router.defaultErrorComponent`

## To Router Cache or not to Router Cache?

There is a high possibility that TanStack's router cache will be a good fit for most smaller to medium size applications, but it's important to understand the tradeoffs of using it vs a more robust caching solution like TanStack Query:

TanStack Router Cache Pros:

- Built-in, easy to use, no extra dependencies
- Handles deduping, preloading, loading, stale-while-revalidate, background refetching on a per-route basis
- Coarse invalidation (invalidate all routes and cache at once)
- Automatic garbage collection
- Works great for apps that share little data between routes
- "Just works" for SSR

TanStack Router Cache Cons:

- No persistence adapters/model
- No shared caching/deduping between routes
- No built-in mutation APIs (a basic `useMutation` hook is provided in many examples that may be sufficient for many use cases)
- No built-in cache-level optimistic update APIs (you can still use ephemeral state from something like a `useMutation` hook to achieve this at the component level)

> [!TIP]
> If you know right away that you'd like to or need to use something more robust like TanStack Query, skip to the [External Data Loading](./external-data-loading.md) guide.

## Using the Router Cache

The router cache is built-in and is as easy as returning data from any route's `loader` function. Let's learn how!

## Route `loader`s

Route `loader` functions are called when a route match is loaded. They are called with a single parameter which is an object containing many helpful properties. We'll go over those in a bit, but first, let's look at the two supported `loader` forms:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
})
```

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: {
    handler: () => fetchPosts(),
  },
})
```

Use the object form when you want to configure loader-specific behavior such as `staleReloadMode`.

## `loader` Parameters

The `loader` function receives a single object with the following properties:

- `abortController` - The route's abortController. Its signal is cancelled when the route is unloaded or when the Route is no longer relevant and the current invocation of the `loader` function becomes outdated.
- `cause` - The cause of the current route match. Can be either one of the following:
  - `enter` - When the route is matched and loaded after not being matched in the previous location.
  - `preload` - When the route is being preloaded.
  - `stay` - When the route is matched and loaded after being matched in the previous location.
- `context` - The route's context object, which is a merged union of:
  - Parent route context
  - This route's context as provided by the `beforeLoad` option
- `deps` - The object value returned from the `Route.loaderDeps` function. If `Route.loaderDeps` is not defined, an empty object will be provided instead.
- `location` - The current location
- `params` - The route's path params
- `parentMatchPromise` - `Promise<RouteMatch>` (`undefined` for the root route)
- `preload` - Boolean which is `true` when the route is being preloaded instead of loaded
- `route` - The route itself

Using these parameters, we can do a lot of cool things, but first, let's take a look at how we can control it and when the `loader` function is called.

## Consuming data from `loader`s

To consume data from a `loader`, use the `useLoaderData` hook defined on your Route object.

```tsx
const posts = Route.useLoaderData()
```

If you don't have ready access to your route object (i.e. you're deep in the component tree for the current route), you can use `getRouteApi` to access the same hook (as well as the other hooks on the Route object). This should be preferred over importing the Route object, which is likely to create circular dependencies.

<!-- ::start:framework -->

# React

```tsx
import { getRouteApi } from '@tanstack/react-router'

// in your component

const routeApi = getRouteApi('/posts')
const data = routeApi.useLoaderData()
```

# Solid

```tsx
import { getRouteApi } from '@tanstack/solid-router'

// in your component

const routeApi = getRouteApi('/posts')
const data = routeApi.useLoaderData()
```

<!-- ::end:framework -->

## Dependency-based Stale-While-Revalidate Caching

TanStack Router provides a built-in Stale-While-Revalidate caching layer for route loaders that is keyed on the dependencies of a route:

- The route's fully parsed pathname
  - e.g. `/posts/1` vs `/posts/2`
- Any additional dependencies provided by the `loaderDeps` option
  - e.g. `loaderDeps: ({ search: { pageIndex, pageSize } }) => ({ pageIndex, pageSize })`

Using these dependencies as keys, TanStack Router will cache the data returned from a route's `loader` function and use it to fulfill subsequent requests for the same route match. This means that if a route's data is already in the cache, it will be returned immediately, then **potentially** be refetched in the background depending on the "freshness" of the data.

### Key options

To control router dependencies and "freshness", TanStack Router provides a plethora of options to control the keying and caching behavior of your route loaders. Let's take a look at them in the order that you are most likely to use them:

- `routeOptions.loaderDeps`
  - A function that supplies you the search params for a router and returns an object of dependencies for use in your `loader` function. When these deps changed from navigation to navigation, it will cause the route to reload regardless of `staleTime`s. The deps are compared using a deep equality check.
- `routeOptions.staleTime`
- `routerOptions.defaultStaleTime`
  - The number of milliseconds that a route's data should be considered fresh when attempting to load.
- `routeOptions.preloadStaleTime`
- `routerOptions.defaultPreloadStaleTime`
  - The number of milliseconds that a route's data should be considered fresh attempting to preload.
- `routeOptions.gcTime`
- `routerOptions.defaultGcTime`
  - The number of milliseconds that a route's data should be kept in the cache before being garbage collected.
- `routeOptions.shouldReload`
  - A function that receives the same `beforeLoad` and `loaderContext` parameters and returns a boolean indicating if the route should reload. This offers one more level of control over when a route should reload beyond `staleTime` and `loaderDeps` and can be used to implement patterns similar to Remix's `shouldLoad` option.
- `routeOptions.loader.staleReloadMode`
- `routerOptions.defaultStaleReloadMode`
  - Controls what happens when a matched route already has stale successful data. Use `'background'` for stale-while-revalidate, or `'blocking'` to wait for the stale loader reload to finish before continuing.

### ⚠️ Some Important Defaults

- By default, the `staleTime` is set to `0`, meaning that the route's data is immediately considered stale. Stale matches are reloaded in the background when the route is entered again, when its loader key changes (path params used by the route or `loaderDeps`), or when `router.load()` is called explicitly.
- By default, a previously preloaded route is considered fresh for **30 seconds**. This means if a route is preloaded, then preloaded again within 30 seconds, the second preload will be ignored. This prevents unnecessary preloads from happening too frequently. **When a route is loaded normally, the standard `staleTime` is used.**
- By default, the `gcTime` is set to **30 minutes**, meaning that any route data that has not been accessed in 30 minutes will be garbage collected and removed from the cache.
- By default, `staleReloadMode` is `'background'`, so stale successful matches keep rendering with their existing `loaderData` while the loader revalidates in the background.
- `router.invalidate()` will force all active routes to reload their loaders immediately and mark every cached route's data as stale.

### Using `loaderDeps` to access search params

Imagine a `/posts` route supports some pagination via search params `offset` and `limit`. For the cache to uniquely store this data, we need to access these search params via the `loaderDeps` function. By explicitly identifying them, each route match for `/posts` with different `offset` and `limit` won't get mixed up!

Once we have these deps in place, the route will always reload when the deps change.

```tsx
// /routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loaderDeps: ({ search: { offset, limit } }) => ({ offset, limit }),
  loader: ({ deps: { offset, limit } }) =>
    fetchPosts({
      offset,
      limit,
    }),
})
```

> [!WARNING]
> **Only include dependencies you actually use in the loader.**
>
> A common mistake is returning the entire `search` object:
>
> ```tsx
> // ❌ Don't do this - causes unnecessary cache invalidation
> loaderDeps: ({ search }) => search,
> loader: ({ deps }) => fetchPosts({ page: deps.page }), // only uses page!
> ```
>
> This causes the route to reload whenever ANY search param changes, even params not used in the loader (like `viewMode` or `sortDirection`). Instead, extract only what you need:
>
> ```tsx
> // ✅ Do this - only reload when used params change
> loaderDeps: ({ search }) => ({
>   page: search.page,
>   limit: search.limit,
> }),
> loader: ({ deps }) => fetchPosts(deps),
> ```

### Using `staleTime` to control how long data is considered fresh

By default, `staleTime` for navigations is set to `0`ms (and 30 seconds for preloads) which means that the route's data will always be considered stale. When a stale route is entered again, its loader key changes, or `router.load()` is called explicitly, the route will reload in the background.

**This is a good default for most use cases, but you may find that some route data is more static or potentially expensive to load.** In these cases, you can use the `staleTime` option to control how long the route's data is considered fresh for navigations. Let's take a look at an example:

```tsx
// /routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  // Consider the route's data fresh for 10 seconds
  staleTime: 10_000,
})
```

By passing `10_000` to the `staleTime` option, we are telling the router to consider the route's data fresh for 10 seconds. This means that if the user navigates to `/posts` from `/about` within 10 seconds of the last loader result, the route's data will not be reloaded. If the user then navigates to `/posts` from `/about` after 10 seconds, the route's data will be reloaded **in the background**.

## Choosing background vs blocking stale reloads

By default, stale successful matches use stale-while-revalidate behavior. That means the router can render with the existing `loaderData` immediately and then refresh it in the background.

If you want a specific loader to wait for a stale reload to finish before continuing, use the object form and set `staleReloadMode: 'blocking'`:

```tsx
// /routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: {
    handler: () => fetchPosts(),
    staleReloadMode: 'blocking',
  },
})
```

You can also change the default for the entire router:

```tsx
const router = createRouter({
  routeTree,
  defaultStaleReloadMode: 'blocking',
})
```

Use `'background'` when showing stale data during revalidation is acceptable. Use `'blocking'` when you want stale matches to behave more like a fresh load and wait for the new loader result.

## Turning off automatic stale reloads

To disable automatic stale reloads for a route, set the `staleTime` option to `Infinity`:

```tsx
// /routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: Infinity,
})
```

You can even turn this off for all routes by setting the `defaultStaleTime` option on the router:

```tsx
const router = createRouter({
  routeTree,
  defaultStaleTime: Infinity,
})
```

This differs from `staleReloadMode: 'blocking'`:

- `staleTime: Infinity` prevents the route from becoming stale in the first place
- `staleReloadMode: 'blocking'` still allows stale reloads, but waits for them instead of doing them in the background

## Using `shouldReload` and `gcTime` to opt-out of caching

Similar to Remix's default functionality, you may want to configure a route to only load on entry or when critical loader deps change. You can do this by using the `gcTime` option combined with the `shouldReload` option, which accepts either a `boolean` or a function that receives the same `beforeLoad` and `loaderContext` parameters and returns a boolean indicating if the route should reload.

```tsx
// /routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loaderDeps: ({ search: { offset, limit } }) => ({ offset, limit }),
  loader: ({ deps }) => fetchPosts(deps),
  // Do not cache this route's data after it's unloaded
  gcTime: 0,
  // Only reload the route when the user navigates to it or when deps change
  shouldReload: false,
})
```

### Opting out of caching while still preloading

Even though you may opt-out of short-term caching for your route data, you can still get the benefits of preloading! With the above configuration, preloading will still "just work" with the default `preloadGcTime`. This means that if a route is preloaded, then navigated to, the route's data will be considered fresh and will not be reloaded.

To opt out of preloading, don't turn it on via the `routerOptions.defaultPreload` or `routeOptions.preload` options.

## Passing all loader events to an external cache

We break down this use case in the [External Data Loading](./external-data-loading.md) page, but if you'd like to use an external cache like TanStack Query, you can do so by passing all loader events to your external cache. As long as you are using the defaults, the only change you'll need to make is to set the `defaultPreloadStaleTime` option on the router to `0`:

```tsx
const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
})
```

This will ensure that every preload, load, and reload event will trigger your `loader` functions, which can then be handled and deduped by your external cache.

## Using Router Context

The `context` argument passed to the `loader` function is an object containing a merged union of:

- Parent route context
- This route's context as provided by the `beforeLoad` option

Starting at the very top of the router, you can pass an initial context to the router via the `context` option. This context will be available to all routes in the router and get copied and extended by each route as they are matched. This happens by passing a context to a route via the `beforeLoad` option. This context will be available to all the route's child routes. The resulting context will be available to the route's `loader` function.

In this example, we'll create a function in our route context to fetch posts, then use it in our `loader` function.

> 🧠 Context is a powerful tool for dependency injection. You can use it to inject services, hooks, and other objects into your router and routes. You can also additively pass data down the route tree at every route using a route's `beforeLoad` option.

- `/utils/fetchPosts.tsx`

```tsx
export const fetchPosts = async () => {
  const res = await fetch(`/api/posts?page=${pageIndex}`)
  if (!res.ok) throw new Error('Failed to fetch posts')
  return res.json()
}
```

- `/routes/__root.tsx`

<!-- ::start:framework -->

# React

```tsx
import { createRootRouteWithContext } from '@tanstack/react-router'

// Create a root route using the createRootRouteWithContext<{...}>() function and pass it whatever types you would like to be available in your router context.
export const Route = createRootRouteWithContext<{
  fetchPosts: typeof fetchPosts
}>()() // NOTE: the double call is on purpose, since createRootRouteWithContext is a factory ;)
```

# Solid

```tsx
import { createRootRouteWithContext } from '@tanstack/solid-router'

// Create a root route using the createRootRouteWithContext<{...}>() function and pass it whatever types you would like to be available in your router context.
export const Route = createRootRouteWithContext<{
  fetchPosts: typeof fetchPosts
}>()() // NOTE: the double call is on purpose, since createRootRouteWithContext is a factory ;)
```

<!-- ::end:framework -->

- `/routes/posts.tsx`

```tsx
// Notice how our postsRoute references context to get our fetchPosts function
// This can be a powerful tool for dependency injection across your router
// and routes.
export const Route = createFileRoute('/posts')({
  loader: ({ context: { fetchPosts } }) => fetchPosts(),
})
```

- `/router.tsx`

```tsx
import { routeTree } from './routeTree.gen'

// Use your routerContext to create a new router
// This will require that you fullfil the type requirements of the routerContext
const router = createRouter({
  routeTree,
  context: {
    // Supply the fetchPosts function to the router context
    fetchPosts,
  },
})
```

## Using Path Params

To use path params in your `loader` function, access them via the `params` property on the function's parameters. Here's an example:

```tsx
// src/routes/posts.$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params: { postId } }) => fetchPostById(postId),
})
```

## Using Route Context

Passing down global context to your router is great, but what if you want to provide context that is specific to a route? This is where the `beforeLoad` option comes in. The `beforeLoad` option is a function that runs right before attempting to load a route and receives the same parameters as `loader`. Beyond its ability to redirect potential matches, block loader requests, etc, it can also return an object that will be merged into the route's context. Let's take a look at an example where we inject some data into our route context via the `beforeLoad` option:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  // Pass the fetchPosts function to the route context
  beforeLoad: () => ({
    fetchPosts: () => console.info('foo'),
  }),
  loader: ({ context: { fetchPosts } }) => {
    fetchPosts() // 'foo'

    // ...
  },
})
```

## Using Search Params in Loaders

> ❓ But wait Tanner... where the heck are my search params?!

You might be here wondering why `search` isn't directly available in the `loader` function's parameters. We've purposefully designed it this way to help you succeed. Let's take a look at why:

- Search Parameters being used in a loader function are a very good indicator that those search params should also be used to uniquely identify the data being loaded. For example, you may have a route that uses a search param like `pageIndex` that uniquely identifies the data held inside of the route match. Or, imagine a `/users/user` route that uses the search param `userId` to identify a specific user in your application, you might model your url like this: `/users/user?userId=123`. This means that your `user` route would need some extra help to identify a specific user.
- Directly accessing search params in a loader function can lead to bugs in caching and preloading where the data being loaded is not unique to the current URL pathname and search params. For example, you might ask your `/posts` route to preload page 2's results, but without the distinction of pages in your route configuration, you will end up fetching, storing and displaying page 2's data on your `/posts` or `?page=1` screen instead of it preloading in the background!
- Placing a threshold between search parameters and the loader function allows the router to understand your dependencies and reactivity.

```tsx
// /routes/users.user.tsx
export const Route = createFileRoute('/users/user')({
  validateSearch: (search) =>
    search as {
      userId: string
    },
  loaderDeps: ({ search: { userId } }) => ({
    userId,
  }),
  loader: async ({ deps: { userId } }) => getUser(userId),
})
```

### Accessing Search Params via `routeOptions.loaderDeps`

```tsx
// /routes/posts.tsx
export const Route = createFileRoute('/posts')({
  // Use zod to validate and parse the search params
  validateSearch: z.object({
    offset: z.number().int().nonnegative().catch(0),
  }),
  // Pass the offset to your loader deps via the loaderDeps function
  loaderDeps: ({ search: { offset } }) => ({ offset }),
  // Use the offset from context in the loader function
  loader: async ({ deps: { offset } }) =>
    fetchPosts({
      offset,
    }),
})
```

## Using the Abort Signal

The `abortController` property of the `loader` function is an [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Its signal is cancelled when the route is unloaded or when the `loader` call becomes outdated. This is useful for cancelling network requests when the route is unloaded or when the route's params change. Here is an example using it with a fetch call:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: ({ abortController }) =>
    fetchPosts({
      // Pass this to an underlying fetch call or anything that supports signals
      signal: abortController.signal,
    }),
})
```

## Using the `preload` flag

The `preload` property of the `loader` function is a boolean which is `true` when the route is being preloaded instead of loaded. Some data loading libraries may handle preloading differently than a standard fetch, so you may want to pass `preload` to your data loading library, or use it to execute the appropriate data loading logic:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: async ({ preload }) =>
    fetchPosts({
      maxAge: preload ? 10_000 : 0, // Preloads should hang around a bit longer
    }),
})
```

## Handling Slow Loaders

Ideally most route loaders can resolve their data within a short moment, removing the need to render a placeholder spinner and simply rely on suspense to render the next route when it's completely ready. When critical data that is required to render a route's component is slow though, you have 2 options:

- Split up your fast and slow data into separate promises and `defer` the slow data until after the fast data is loaded (see the [Deferred Data Loading](./deferred-data-loading.md) guide).
- Show a pending component after an optimistic suspense threshold until all of the data is ready (See below).

## Showing a pending component

**By default, TanStack Router will show a pending component for loaders that take longer than 1 second to resolve.** This is an optimistic threshold that can be configured via:

- `routeOptions.pendingMs` or
- `routerOptions.defaultPendingMs`

When the pending time threshold is exceeded, the router will render the `pendingComponent` option of the route, if configured.

## Avoiding Pending Component Flash

If you're using a pending component, the last thing you want is for your pending time threshold to be met, then have your data resolve immediately after, resulting in a jarring flash of your pending component. To avoid this, **TanStack Router by default will show your pending component for at least 500ms**. This is an optimistic threshold that can be configured via:

- `routeOptions.pendingMinMs` or
- `routerOptions.defaultPendingMinMs`

## Handling Errors

TanStack Router provides a few ways to handle errors that occur during the route loading lifecycle. Let's take a look at them.

### Handling Errors with `routeOptions.onError`

The `routeOptions.onError` option is a function that is called when an error occurs during the route loading.

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  onError: ({ error }) => {
    // Log the error
    console.error(error)
  },
})
```

### Handling Errors with `routeOptions.onCatch`

The `routeOptions.onCatch` option is a function that is called whenever an error was caught by the router's CatchBoundary.

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  onCatch: ({ error, errorInfo }) => {
    // Log the error
    console.error(error)
  },
})
```

### Handling Errors with `routeOptions.errorComponent`

The `routeOptions.errorComponent` option is a component that is rendered when an error occurs during the route loading or rendering lifecycle. It is rendered with the following props:

- `error` - The error that occurred
- `reset` - A function to reset the internal `CatchBoundary`

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error }) => {
    // Render an error message
    return <div>{error.message}</div>
  },
})
```

The `reset` function can be used to allow the user to retry rendering the error boundaries normal children:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error, reset }) => {
    return (
      <div>
        {error.message}
        <button
          onClick={() => {
            // Reset the router error boundary
            reset()
          }}
        >
          retry
        </button>
      </div>
    )
  },
})
```

If the error was the result of a route load, you should instead call `router.invalidate()`, which will coordinate both a router reload and an error boundary reset:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error, reset }) => {
    const router = useRouter()

    return (
      <div>
        {error.message}
        <button
          onClick={() => {
            // Invalidate the route to reload the loader, which will also reset the error boundary
            router.invalidate()
          }}
        >
          retry
        </button>
      </div>
    )
  },
})
```

### Using the default `ErrorComponent`

TanStack Router provides a default `ErrorComponent` that is rendered when an error occurs during the route loading or rendering lifecycle. If you choose to override your routes' error components, it's still wise to always fall back to rendering any uncaught errors with the default `ErrorComponent`:

```tsx
// src/routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error }) => {
    if (error instanceof MyCustomError) {
      // Render a custom error message
      return <div>{error.message}</div>
    }

    // Fallback to the default ErrorComponent
    return <ErrorComponent error={error} />
  },
})
```
