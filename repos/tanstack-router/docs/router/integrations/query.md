---
id: query
title: TanStack Query Integration
---

> [!IMPORTANT]
> This integration automates SSR dehydration/hydration and streaming between TanStack Router and TanStack Query. If you haven't read the standard [External Data Loading](../guide/external-data-loading.md) guide, start there.

## What you get

- **Automatic SSR dehydration/hydration** of your `QueryClient`
- **Streaming of queries** that resolve during initial server render to the client
- **Redirect handling** for `redirect()` thrown from queries/mutations
- Optional **provider wrapping** with `QueryClientProvider`

## Installation

The TanStack query integration is a separate package that you need to install:

<!-- ::start:tabs variant="package-manager" mode="dev-install" -->

react: @tanstack/react-router-ssr-query
solid: @tanstack/solid-router-ssr-query

<!-- ::end:tabs -->

## Setup

Create your router and wire up the integration. Ensure a fresh `QueryClient` is created per request in SSR environments.

<!-- ::start:framework -->

# React

```tsx title="src/router.tsx"
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree,
    // optionally expose the QueryClient via router context
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    // optional:
    // handleRedirects: true,
    // wrapQueryClient: true,
  })

  return router
}
```

<!-- ::end:framework -->

By default, the integration wraps your router with a `QueryClientProvider`. If you already provide your own provider, pass `wrapQueryClient: false` and keep your custom wrapper.

You can also pass `dehydrateOptions` and `hydrateOptions` to customize how TanStack Query serializes SSR payloads and restores them on the client.

```tsx
setupRouterSsrQueryIntegration({
  router,
  queryClient,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.meta?.ssr !== false,
  },
  hydrateOptions: {
    defaultOptions: {
      queries: {
        gcTime: 60_000,
      },
    },
  },
})
```

Common uses for these options:

- Set `hydrateOptions.defaultOptions.queries.gcTime` to control how long hydrated SSR queries stay in the client cache before garbage collection.
- Set `dehydrateOptions.shouldDehydrateQuery` to exclude queries you do not want serialized into the HTML payload.
- Set `dehydrateOptions.serializeData` and `hydrateOptions.defaultOptions.deserializeData` when your SSR payload needs custom serialization.

```tsx title="src/router.tsx"
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient },
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    hydrateOptions: {
      defaultOptions: {
        queries: {
          gcTime: 5 * 60 * 1000,
        },
      },
    },
  })

  return router
}
```

## SSR behavior and streaming

- During server render, the integration dehydrates initial queries and streams any subsequent queries that resolve while rendering.
- On the client, the integration hydrates the initial state, then incrementally hydrates streamed queries.
- Queries from `useSuspenseQuery` or loader prefetches participate in SSR/streaming. Plain `useQuery` does not execute on the server.

## Use in routes

### Using useSuspenseQuery vs useQuery

- `useSuspenseQuery`: runs on the server during SSR when its data is required and will be streamed to the client as it resolves.
- `useQuery`: does not execute on the server; it will fetch on the client after hydration. Use this for data that is not required for SSR.

<!-- ::start:framework -->

# React

```tsx
// Suspense: executes on server and streams
const { data } = useSuspenseQuery(postsQuery)

// Non-suspense: executes only on client
const { data, isLoading } = useQuery(postsQuery)
```

<!-- ::end:framework -->

### Preload with a loader and read with a hook

Preload critical data in the route `loader` to avoid waterfalls and loading flashes, then read it in the component. The integration ensures server-fetched data is dehydrated and streamed to the client during SSR.

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.tsx"
import { queryOptions, useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

const postsQuery = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetch('/api/posts').then((r) => r.json()),
})

export const Route = createFileRoute('/posts')({
  // Ensure the data is in the cache before render
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: PostsPage,
})

function PostsPage() {
  // Prefer suspense for best SSR + streaming behavior
  const { data } = useSuspenseQuery(postsQuery)
  return <div>{data.map((p: any) => p.title).join(', ')}</div>
}
```

<!-- ::end:framework -->

### Prefetching and streaming

You can also prefetch with `fetchQuery` or `ensureQueryData` in a loader without consuming the data in a component. If you return the promise directly from the loader, it will be awaited and thus block the SSR request until the query finishes. If you don't await the promise nor return it, the query will be started on the server and will be streamed to the client without blocking the SSR request.

<!-- ::start:framework -->

# React

```tsx title="src/routes/users.$id.tsx"
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'

const userQuery = (id: string) =>
  queryOptions({
    queryKey: ['user', id],
    queryFn: () => fetch(`/api/users/${id}`).then((r) => r.json()),
  })

export const Route = createFileRoute('/user/$id')({
  loader: ({ params }) => {
    // do not await this nor return the promise, just kick off the query to stream it to the client
    context.queryClient.fetchQuery(userQuery(params.id))
  },
})
```

<!-- ::end:framework -->

## Redirect handling

If a query or mutation throws a `redirect(...)`, the integration intercepts it on the client and performs a router navigation.

- Enabled by default
- Disable with `handleRedirects: false` if you need custom handling

## Works with TanStack Start

TanStack Start uses TanStack Router under the hood. The same setup applies, and the integration will stream query results during SSR automatically.
