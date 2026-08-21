---
name: router-core/not-found-and-errors
description: >-
  notFound() function, notFoundComponent, defaultNotFoundComponent,
  notFoundMode (fuzzy/root), errorComponent, CatchBoundary,
  CatchNotFound, isNotFound, NotFoundRoute (deprecated), route
  masking (mask option, createRouteMask, unmaskOnReload).
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/not-found-errors.md
  - TanStack/router:docs/router/guide/route-masking.md
---

# Not Found and Errors

TanStack Router handles two categories of "not found": unmatched URL paths (automatic) and missing resources like a post that doesn't exist (manual via `notFound()`). Error boundaries are configured per-route via `errorComponent`.

> **CRITICAL**: Do NOT use the deprecated `NotFoundRoute`. When present, `notFound()` and `notFoundComponent` will NOT work. Remove it and use `notFoundComponent` instead.
> **CRITICAL**: `useLoaderData` may be undefined inside `notFoundComponent`. Use `useParams`, `useSearch`, or `useRouteContext` instead.

## Not Found Handling

### Global 404: `notFoundComponent` on Root Route

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => {
    return (
      <div>
        <h1>404 — Page Not Found</h1>
        <Link to="/">Go Home</Link>
      </div>
    )
  },
})
```

### Router-Wide Default: `defaultNotFoundComponent`

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
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

### Per-Route 404: Missing Resources with `notFound()`

Throw `notFound()` in `loader` or `beforeLoad` when a resource doesn't exist. It works like `redirect()` — throw it to trigger the not-found boundary.

```tsx
// src/routes/posts.$postId.tsx
import { createFileRoute, notFound } from '@tanstack/react-router'
import { getPost } from '../api'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await getPost(postId)
    if (!post) throw notFound()
    return { post }
  },
  component: PostComponent,
  notFoundComponent: ({ data }) => {
    const { postId } = Route.useParams()
    return <p>Post "{postId}" not found</p>
  },
})

function PostComponent() {
  const { post } = Route.useLoaderData()
  return <h1>{post.title}</h1>
}
```

### Targeting a Specific Route with `notFound({ routeId })`

You can force a specific parent route to handle the not-found error:

```tsx
// src/routes/_layout/posts.$postId.tsx
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await getPost(postId)
    if (!post) throw notFound({ routeId: '/_layout' })
    return { post }
  },
})
```

### Targeting Root Route with `rootRouteId`

```tsx
import { createFileRoute, notFound, rootRouteId } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await getPost(postId)
    if (!post) throw notFound({ routeId: rootRouteId })
    return { post }
  },
})
```

## `notFoundMode`: Fuzzy vs Root

### `fuzzy` (default)

The router finds the nearest parent route with children and a `notFoundComponent`. Preserves as much parent layout as possible.

Given routes: `__root__` → `posts` → `$postId`, accessing `/posts/1/edit`:

- `<Root>` renders
- `<Posts>` renders
- `<Posts.notFoundComponent>` renders (nearest parent with children + notFoundComponent)

### `root`

All not-found errors go to the root route's `notFoundComponent`, regardless of matching:

```tsx
const router = createRouter({
  routeTree,
  notFoundMode: 'root',
})
```

## Error Handling

### `errorComponent` Per Route

`errorComponent` receives `error`, `info`, and `reset` props. For loader errors, use `router.invalidate()` to re-run the loader — it automatically resets the error boundary.

```tsx
// src/routes/posts.$postId.tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const res = await fetch(`/api/posts/${postId}`)
    if (!res.ok) throw new Error('Failed to load post')
    return res.json()
  },
  component: PostComponent,
  errorComponent: PostErrorComponent,
})

function PostErrorComponent({
  error,
}: {
  error: Error
  info: { componentStack: string }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <div>
      <p>Error: {error.message}</p>
      <button
        onClick={() => {
          // Invalidate re-runs the loader and resets the error boundary
          router.invalidate()
        }}
      >
        Retry
      </button>
    </div>
  )
}

function PostComponent() {
  const data = Route.useLoaderData()
  return <h1>{data.title}</h1>
}
```

### Router-Wide Default Error Component

```tsx
const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error }) => {
    const router = useRouter()
    return (
      <div>
        <p>Something went wrong: {error.message}</p>
        <button
          onClick={() => {
            router.invalidate()
          }}
        >
          Retry
        </button>
      </div>
    )
  },
})
```

## Data in `notFoundComponent`

`notFoundComponent` cannot reliably use `useLoaderData` because the loader may not have completed. Safe hooks:

```tsx
notFoundComponent: ({ data }) => {
  // SAFE — always available:
  const params = Route.useParams()
  const search = Route.useSearch()
  const context = Route.useRouteContext()

  // UNSAFE — may be undefined:
  // const loaderData = Route.useLoaderData()

  return <p>Item {params.id} not found</p>
}
```

To forward partial data, use the `data` option on `notFound()`:

```tsx
loader: async ({ params }) => {
  const partialData = await getPartialData(params.id)
  if (!partialData.fullResource) {
    throw notFound({ data: { name: partialData.name } })
  }
  return partialData
},
notFoundComponent: ({ data }) => {
  // data is typed as unknown — validate it
  const info = data as { name: string } | undefined
  return <p>{info?.name ?? 'Resource'} not found</p>
},
```

## Route Masking

Route masking shows a different URL in the browser bar than the actual route being rendered. Masking data is stored in `location.state` and is lost when the URL is shared or opened in a new tab.

### Imperative Masking on `<Link>`

```tsx
import { Link } from '@tanstack/react-router'

function PhotoGrid({ photoId }: { photoId: string }) {
  return (
    <Link
      to="/photos/$photoId/modal"
      params={{ photoId }}
      mask={{
        to: '/photos/$photoId',
        params: { photoId },
      }}
    >
      Open Photo
    </Link>
  )
}
```

### Imperative Masking with `useNavigate`

```tsx
import { useNavigate } from '@tanstack/react-router'

function OpenPhotoButton({ photoId }: { photoId: string }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() =>
        navigate({
          to: '/photos/$photoId/modal',
          params: { photoId },
          mask: {
            to: '/photos/$photoId',
            params: { photoId },
          },
        })
      }
    >
      Open Photo
    </button>
  )
}
```

### Declarative Masking with `createRouteMask`

```tsx
import { createRouter, createRouteMask } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const photoModalMask = createRouteMask({
  routeTree,
  from: '/photos/$photoId/modal',
  to: '/photos/$photoId',
  params: (prev) => ({ photoId: prev.photoId }),
})

const router = createRouter({
  routeTree,
  routeMasks: [photoModalMask],
})
```

### Unmasking on Reload

By default, masks survive local page reloads. To unmask on reload:

```tsx
// Per-mask
const mask = createRouteMask({
  routeTree,
  from: '/photos/$photoId/modal',
  to: '/photos/$photoId',
  params: (prev) => ({ photoId: prev.photoId }),
  unmaskOnReload: true,
})

// Per-link
<Link
  to="/photos/$photoId/modal"
  params={{ photoId }}
  mask={{ to: '/photos/$photoId', params: { photoId } }}
  unmaskOnReload
>
  Open Photo
</Link>

// Router-wide default
const router = createRouter({
  routeTree,
  unmaskOnReload: true,
})
```

## Common Mistakes

### 1. HIGH: Using deprecated `NotFoundRoute`

```tsx
// WRONG — NotFoundRoute blocks notFound() and notFoundComponent from working
import { NotFoundRoute } from '@tanstack/react-router'
const notFoundRoute = new NotFoundRoute({ component: () => <p>404</p> })
const router = createRouter({ routeTree, notFoundRoute })

// CORRECT — use notFoundComponent on root route
export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <p>404</p>,
})
```

### 2. MEDIUM: Expecting `useLoaderData` in `notFoundComponent`

```tsx
// WRONG — loader may not have completed
notFoundComponent: () => {
  const data = Route.useLoaderData() // may be undefined!
  return <p>{data.title} not found</p>
}

// CORRECT — use safe hooks
notFoundComponent: () => {
  const { postId } = Route.useParams()
  return <p>Post {postId} not found</p>
}
```

### 3. MEDIUM: Leaf routes cannot handle not-found errors

Only routes with children (and therefore an `<Outlet>`) can render `notFoundComponent`. Leaf routes (routes without children) will never catch not-found errors — the error bubbles up to the nearest parent with children.

```tsx
// This route has NO children — notFoundComponent here will not catch
// unmatched child paths (there are no child paths to unmatch)
export const Route = createFileRoute('/posts/$postId')({
  // notFoundComponent here only works for notFound() thrown in THIS route's loader
  // It does NOT catch path-based not-founds
  notFoundComponent: () => <p>Not found</p>,
})
```

### 4. MEDIUM: Expecting masked URLs to survive sharing

Masking data lives in `location.state` (browser history). When a masked URL is copied, shared, or opened in a new tab, the masking data is lost. The browser navigates to the visible (masked) URL directly.

### 5. HIGH (cross-skill): Using `reset()` alone instead of `router.invalidate()`

```tsx
// WRONG — reset() clears the error boundary but does NOT re-run the loader
function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return <button onClick={reset}>Retry</button>
}

// CORRECT — invalidate re-runs loaders and resets the error boundary
function ErrorFallback({ error }: { error: Error; reset: () => void }) {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        router.invalidate()
      }}
    >
      Retry
    </button>
  )
}
```

## Cross-References

- **router-core/data-loading** — `notFound()` thrown in loaders interacts with error boundaries and loader data availability. `errorComponent` retry requires `router.invalidate()`.
- **router-core/type-safety** — `notFoundComponent` data is typed as `unknown`; validate before use.
