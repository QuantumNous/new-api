---
name: router-core/type-safety
description: >-
  Full type inference philosophy (never cast, never annotate inferred
  values), Register module declaration, from narrowing on hooks and
  Link, strict:false for shared components, getRouteApi for code-split
  typed access, addChildren with object syntax for TS perf, LinkProps
  and ValidateLinkOptions type utilities, as const satisfies pattern.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/type-safety.md
  - TanStack/router:docs/router/guide/type-utilities.md
  - TanStack/router:docs/router/guide/render-optimizations.md
---

# Type Safety

TanStack Router is FULLY type-inferred. Params, search params, context, and loader data all flow through the route tree automatically. The **#1 AI agent mistake** is adding type annotations, casts, or generic parameters to values that are already inferred.

> **CRITICAL**: NEVER use `as Type`, explicit generic params, `satisfies` on hook returns, or type annotations on inferred values. Every cast masks real type errors and breaks the inference chain.
> **CRITICAL**: Do NOT confuse TanStack Router with Next.js or React Router. There is no `getServerSideProps`, no `useSearchParams()`, no `useLoaderData()` from `react-router-dom`.

## The ONE Required Type Annotation: Register

Without this, top-level exports like `Link`, `useNavigate`, `useSearch` have no type safety.

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

// THIS IS REQUIRED — the single type registration for the entire app
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default router
```

After registration, every `Link`, `useNavigate`, `useSearch`, `useParams` across the app is fully typed.

## Types Flow Automatically

### Route Hooks — No Annotation Needed

```tsx
// src/routes/posts.$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page ?? 1),
  }),
  loader: async ({ params }) => {
    // params.postId is already typed as string — do not annotate
    const post = await fetchPost(params.postId)
    return { post }
  },
  component: PostComponent,
})

function PostComponent() {
  // ALL of these are fully inferred — do NOT add type annotations
  const { postId } = Route.useParams()
  //      ^? string

  const { page } = Route.useSearch()
  //      ^? number

  const { post } = Route.useLoaderData()
  //      ^? { id: string; title: string; body: string }

  return (
    <div>
      <h1>{post.title}</h1>
      <p>Page {page}</p>
    </div>
  )
}
```

### Context Flows Through the Tree

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

interface RouterContext {
  auth: { userId: string; role: 'admin' | 'user' } | null
}

// Note: createRootRouteWithContext is a FACTORY — call it TWICE: ()()
export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
})
```

```tsx
// src/routes/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    // context.auth is already typed as { userId: string; role: 'admin' | 'user' } | null
    // NO annotation needed
    if (!context.auth) throw redirect({ to: '/login' })
    return { user: context.auth }
  },
  loader: ({ context }) => {
    // context.user is typed as { userId: string; role: 'admin' | 'user' }
    // This was added by beforeLoad above — fully inferred
    return fetchDashboard(context.user.userId)
  },
  component: DashboardComponent,
})

function DashboardComponent() {
  const data = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  return <h1>Welcome {user.userId}</h1>
}
```

## Narrowing with `from`

Without `from`, hooks return a union of ALL routes' types — slow for TypeScript and imprecise.

### On Hooks

```tsx
import { useSearch, useParams, useNavigate } from '@tanstack/react-router'

function PostSidebar() {
  // WRONG — search is a union of ALL routes' search params
  const search = useSearch()

  // CORRECT — search is narrowed to /posts/$postId's search params
  const search = useSearch({ from: '/posts/$postId' })
  //    ^? { page: number }

  // CORRECT — params narrowed to this route
  const { postId } = useParams({ from: '/posts/$postId' })

  // CORRECT — navigate narrowed for relative paths
  const navigate = useNavigate({ from: '/posts/$postId' })
}
```

### On `Link`

```tsx
import { Link } from '@tanstack/react-router'

// WRONG — search resolves to union of ALL routes' search params, slow TS check
<Link to=".." search={{ page: 0 }} />

// CORRECT — narrowed, fast TS check
<Link from="/posts/$postId" to=".." search={{ page: 0 }} />

// Also correct — Route.fullPath in route components
<Link from={Route.fullPath} to=".." search={{ page: 0 }} />
```

## Shared Components: `strict: false`

When a component is used across multiple routes, use `strict: false` instead of `from`:

```tsx
import { useSearch } from '@tanstack/react-router'

function GlobalSearch() {
  // Returns union of all routes' search params — no runtime error if route doesn't match
  const search = useSearch({ strict: false })
  return <span>Query: {search.q ?? ''}</span>
}
```

## Code-Split Files: `getRouteApi`

Use `getRouteApi` instead of importing `Route` to avoid pulling route config into the lazy chunk:

```tsx
// src/routes/posts.lazy.tsx
import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts')

export const Route = createLazyFileRoute('/posts')({
  component: PostsComponent,
})

function PostsComponent() {
  const data = routeApi.useLoaderData()
  const { page } = routeApi.useSearch()
  return <div>Page {page}</div>
}
```

## TypeScript Performance

### Use Object Syntax for `addChildren` in Large Route Trees

```tsx
// SLOWER — tuple syntax
const routeTree = rootRoute.addChildren([
  postsRoute.addChildren([postRoute, postsIndexRoute]),
  indexRoute,
])

// FASTER — object syntax (TS checks objects faster than large tuples)
const routeTree = rootRoute.addChildren({
  postsRoute: postsRoute.addChildren({ postRoute, postsIndexRoute }),
  indexRoute,
})
```

With file-based routing the route tree is generated, so this is handled for you.

### Avoid Returning Unused Inferred Types from Loaders

When using external caches like TanStack Query, don't let the router infer complex return types you never consume:

```tsx
// SLOWER — TS infers the full ensureQueryData return type into the route tree
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ context: { queryClient }, params: { postId } }) =>
    queryClient.ensureQueryData(postQueryOptions(postId)),
  component: PostComponent,
})

// FASTER — void return, inference stays out of the route tree
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ context: { queryClient }, params: { postId } }) => {
    await queryClient.ensureQueryData(postQueryOptions(postId))
  },
  component: PostComponent,
})
```

### `as const satisfies` for Link Option Objects

Never use `LinkProps` as a variable type — it's an enormous union:

```tsx
import type { LinkProps, RegisteredRouter } from '@tanstack/react-router'

// WRONG — LinkProps is a massive union, extremely slow TS check
const wrongProps: LinkProps = { to: '/posts' }

// CORRECT — infer a precise type, validate against LinkProps
const goodProps = { to: '/posts' } as const satisfies LinkProps

// EVEN BETTER — narrow LinkProps with generic params
const narrowedProps = {
  to: '/posts',
} as const satisfies LinkProps<RegisteredRouter, string, '/posts'>
```

### Type-Safe Link Option Arrays

```tsx
import type { LinkProps } from '@tanstack/react-router'

export const navLinks = [
  { to: '/posts' },
  { to: '/posts/$postId', params: { postId: '1' } },
] as const satisfies ReadonlyArray<LinkProps>

// Use the precise inferred type, not LinkProps directly
export type NavLink = (typeof navLinks)[number]
```

## Type Utilities for Generic Components

### `ValidateLinkOptions` — Type-Safe Link Props in Custom Components

```tsx
import {
  Link,
  type RegisteredRouter,
  type ValidateLinkOptions,
} from '@tanstack/react-router'

interface NavItemProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> {
  label: string
  linkOptions: ValidateLinkOptions<TRouter, TOptions>
}

export function NavItem<TRouter extends RegisteredRouter, TOptions>(
  props: NavItemProps<TRouter, TOptions>,
): React.ReactNode
export function NavItem(props: NavItemProps): React.ReactNode {
  return (
    <li>
      <Link {...props.linkOptions}>{props.label}</Link>
    </li>
  )
}

// Usage — fully type-safe
<NavItem label="Posts" linkOptions={{ to: '/posts' }} />
<NavItem label="Post" linkOptions={{ to: '/posts/$postId', params: { postId: '1' } }} />
```

### `ValidateNavigateOptions` and `ValidateRedirectOptions`

Same pattern as `ValidateLinkOptions` above, for `useNavigate` and `redirect`. Declare a generic public overload plus a non-generic implementation signature so the call site stays narrowed and the body works without casts:

```tsx
import {
  useNavigate,
  type RegisteredRouter,
  type ValidateNavigateOptions,
} from '@tanstack/react-router'

export function useDelayedNavigate<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
>(
  options: ValidateNavigateOptions<TRouter, TOptions>,
  delayMs: number,
): () => void
export function useDelayedNavigate(
  options: ValidateNavigateOptions,
  delayMs: number,
) {
  const navigate = useNavigate()
  return () => {
    setTimeout(() => navigate(options), delayMs)
  }
}
```

`ValidateRedirectOptions` works identically — declare a generic overload accepting `ValidateRedirectOptions<TRouter, TOptions>` and an impl signature accepting `ValidateRedirectOptions`, then call `redirect(options)` in the body.

### Render Props for Maximum Performance

Instead of accepting `LinkProps`, invert control so `Link` is narrowed at the call site:

```tsx
function Card(props: { title: string; renderLink: () => React.ReactNode }) {
  return (
    <div>
      <h2>{props.title}</h2>
      {props.renderLink()}
    </div>
  )
}

// Link narrowed to exactly /posts — no union check
;<Card title="All Posts" renderLink={() => <Link to="/posts">View</Link>} />
```

## Render Optimizations

### Fine-Grained Selectors with `select`

```tsx
function PostTitle() {
  // Only re-renders when page changes, not when other search params change
  const page = Route.useSearch({ select: ({ page }) => page })
  return <span>Page {page}</span>
}
```

### Structural Sharing

Preserve referential identity across re-renders for search params:

```tsx
const router = createRouter({
  routeTree,
  defaultStructuralSharing: true, // Enable globally
})

// Or per-hook
const result = Route.useSearch({
  select: (search) => ({ foo: search.foo, label: `Page ${search.foo}` }),
  structuralSharing: true,
})
```

Structural sharing only works with JSON-compatible data. TypeScript will error if you return class instances with `structuralSharing: true`.

## Common Mistakes

### 1. CRITICAL: Adding type annotations or casts to inferred values

```tsx
// WRONG — casting masks real type errors
const search = useSearch({ from: '/posts' }) as { page: number }

// WRONG — unnecessary annotation
const params: { postId: string } = useParams({ from: '/posts/$postId' })

// WRONG — generic param on hook
const data = useLoaderData<{ posts: Post[] }>({ from: '/posts' })

// CORRECT — let inference work
const search = useSearch({ from: '/posts' })
const params = useParams({ from: '/posts/$postId' })
const data = useLoaderData({ from: '/posts' })
```

### 2. HIGH: Using un-narrowed `LinkProps` type

```tsx
// WRONG — LinkProps is a massive union, causes severe TS slowdown
const myProps: LinkProps = { to: '/posts' }

// CORRECT — use as const satisfies for precise inference
const myProps = { to: '/posts' } as const satisfies LinkProps
```

### 3. HIGH: Not narrowing `Link`/`useNavigate` with `from`

```tsx
// WRONG — search is a union of ALL routes, TS check grows with route count
<Link to=".." search={{ page: 0 }} />

// CORRECT — narrowed, fast check
<Link from={Route.fullPath} to=".." search={{ page: 0 }} />
```

### 4. CRITICAL (cross-skill): Missing router type registration

```tsx
// WRONG — Link/useNavigate have no autocomplete, all paths are untyped strings
const router = createRouter({ routeTree })
// (no declare module)

// CORRECT — always register
const router = createRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

### 5. CRITICAL (cross-skill): Wrong-framework imports and file structure

Wrong-framework code looks plausible (it's React) but breaks the build or produces conflicting `/` routes at runtime.

```tsx
// WRONG — react-router-dom and next/* are different libraries
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

// CORRECT — all routing exports come from @tanstack/react-router
import {
  Link,
  Outlet,
  useNavigate,
  useRouter,
  useLocation,
  useParams,
  redirect,
} from '@tanstack/react-router'
```

```tsx
// WRONG file structures + APIs:
//   src/pages/*.tsx with getServerSideProps / getStaticProps  (Next.js Pages Router)
//   app/layout.tsx + app/page.tsx                              (Next.js App Router)
//   _app/index.tsx, pages/_app.tsx, pages/_document.tsx        (Next.js custom App)
//   loader/action exports                                       (Remix)

// CORRECT — TanStack file-based routing at src/routes/*.tsx
export const Route = createFileRoute('/posts')({
  loader: async () => { ... },
  validateSearch: zodValidator(schema),
  component: PostsComponent,
})
const search = Route.useSearch()
```

If a build error mentions `react-router-dom`, `next/`, `pages/_app`, or duplicate `/` routes, fix the import — don't paper over with type assertions.

See also: router-core (Register setup), router-core/navigation (from narrowing), router-core/code-splitting (getRouteApi).
