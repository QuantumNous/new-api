---
id: external-data-loading
title: External Data Loading
---

> [!IMPORTANT]
> This guide is geared towards external state management libraries and their integration with TanStack Router for data fetching, ssr, hydration/dehydration and streaming. If you haven't read the standard [Data Loading](./data-loading.md) guide, please do so first.

## To **Store** or to **Coordinate**?

While Router is very capable of storing and managing most data needs out of the box, sometimes you just might want something more robust!

Router is designed to be a perfect **coordinator** for external data fetching and caching libraries. This means that you can use any data fetching/caching library you want, and the router will coordinate the loading of your data in a way that aligns with your users' navigation and expectations of freshness.

## What data fetching libraries are supported?

Any data fetching library that supports asynchronous promises can be used with TanStack Router. This includes:

- [TanStack Query](https://tanstack.com/query/latest/docs/react/overview)
- [SWR](https://swr.vercel.app/)
- [RTK Query](https://redux-toolkit.js.org/rtk-query/overview)
- [urql](https://formidable.com/open-source/urql/)
- [Relay](https://relay.dev/)
- [Apollo](https://www.apollographql.com/docs/react/)

Or, even...

- [Zustand](https://zustand-demo.pmnd.rs/)
- [Jotai](https://jotai.org/)
- [Recoil](https://recoiljs.org/)
- [Redux](https://redux.js.org/)

Literally any library that **can return a promise and read/write data** can be integrated.

## Using Loaders to ensure data is loaded

The easiest way to integrate external caching/data library into Router is to use `route.loader`s to ensure that the data required inside of a route has been loaded and is ready to be displayed.

> ⚠️ BUT WHY? It's very important to preload your critical render data in the loader for a few reasons:
>
> - No "flash of loading" states
> - No waterfall data fetching, caused by component based fetching
> - Better for SEO. If your data is available at render time, it will be indexed by search engines.

Here is a naive illustration (don't do this) of using a Route's `loader` option to seed the cache for some data:

```tsx
// src/routes/posts.tsx
let postsCache = []

export const Route = createFileRoute('/posts')({
  loader: async () => {
    postsCache = await fetchPosts()
  },
  component: () => {
    return (
      <div>
        {postsCache.map((post) => (
          <Post key={post.id} post={post} />
        ))}
      </div>
    )
  },
})
```

This example is **obviously flawed**, but illustrates the point that you can use a route's `loader` option to seed your cache with data. Let's take a look at a more realistic example using TanStack Query.

- Replace `fetchPosts` with your preferred data fetching library's prefetching API
- Replace `postsCache` with your preferred data fetching library's read-or-fetch API or hook

## A more realistic example using TanStack Query

Let's take a look at a more realistic example using TanStack Query.

```tsx
// src/routes/posts.tsx
const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetchPosts(),
})

export const Route = createFileRoute('/posts')({
  // Use the `loader` option to ensure that the data is loaded
  loader: () => queryClient.ensureQueryData(postsQueryOptions),
  component: () => {
    // Read the data from the cache and subscribe to updates
    const {
      data: { posts },
    } = useSuspenseQuery(postsQueryOptions)

    return (
      <div>
        {posts.map((post) => (
          <Post key={post.id} post={post} />
        ))}
      </div>
    )
  },
})
```

### Error handling with TanStack Query

When an error occurs while using `suspense` with `TanStack Query`, you need to let queries know that you want to try again when re-rendering. This can be done by using the `reset` function provided by the `useQueryErrorResetBoundary` hook. You can invoke this function in an effect as soon as the error component mounts. This will make sure that the query is reset and will try to fetch data again when the route component is rendered again. This will also cover cases where users navigate away from the route instead of clicking the `retry` button.

```tsx
export const Route = createFileRoute('/')({
  loader: () => queryClient.ensureQueryData(postsQueryOptions),
  errorComponent: ({ error, reset }) => {
    const router = useRouter()
    const queryErrorResetBoundary = useQueryErrorResetBoundary()

    useEffect(() => {
      // Reset the query error boundary
      queryErrorResetBoundary.reset()
    }, [queryErrorResetBoundary])

    return (
      <div>
        {error.message}
        <button
          onClick={() => {
            // Invalidate the route to reload the loader, and reset any router error boundaries
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

## SSR Dehydration/Hydration

Tools that are able can integrate with TanStack Router's convenient Dehydration/Hydration APIs to shuttle dehydrated data between the server and client and rehydrate it where needed. Let's go over how to do this with both 3rd party critical data and 3rd party deferred data.

## Critical Dehydration/Hydration

**For critical data needed for the first render/paint**, TanStack Router supports **`dehydrate` and `hydrate`** options when configuring the `Router`. These callbacks are functions that are automatically called on the server and client when the router dehydrates and hydrates normally and allow you to augment the dehydrated data with your own data.

The `dehydrate` function can return any serializable JSON data which will get merged and injected into the dehydrated payload that is sent to the client.

For example, let's dehydrate and hydrate a TanStack Query `QueryClient` so that our data we fetched on the server will be available for hydration on the client.

```tsx
// src/router.tsx

export function createRouter() {
  // Make sure you create your loader client or similar data
  // stores inside of your `createRouter` function. This ensures
  // that your data stores are unique to each request and
  // always present on both server and client.
  const queryClient = new QueryClient()

  return createRouter({
    routeTree,
    // Optionally provide your loaderClient to the router context for
    // convenience (you can provide anything you want to the router
    // context!)
    context: {
      queryClient,
    },
    // On the server, dehydrate the loader client so the router
    // can serialize it and send it to the client for us
    dehydrate: () => {
      return {
        queryClientState: dehydrate(queryClient),
      }
    },
    // On the client, hydrate the loader client with the data
    // we dehydrated on the server
    hydrate: (dehydrated) => {
      hydrate(queryClient, dehydrated.queryClientState)
    },
    // Optionally, we can use `Wrap` to wrap our router in the loader client provider
    Wrap: ({ children }) => {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    },
  })
}
```
