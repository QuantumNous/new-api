---
name: router-core/navigation
description: >-
  Link component, useNavigate, Navigate component, router.navigate,
  ToOptions/NavigateOptions/LinkOptions, from/to relative navigation,
  activeOptions/activeProps, preloading (intent/viewport/render),
  preloadDelay, navigation blocking (useBlocker, Block), createLink,
  linkOptions helper, scroll restoration, MatchRoute.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/navigation.md
  - TanStack/router:docs/router/guide/preloading.md
  - TanStack/router:docs/router/guide/navigation-blocking.md
  - TanStack/router:docs/router/guide/link-options.md
  - TanStack/router:docs/router/guide/custom-link.md
  - TanStack/router:docs/router/guide/scroll-restoration.md
---

# Navigation

## Setup

Basic type-safe `Link` with `to` and `params`:

```tsx
import { Link } from '@tanstack/react-router'

function PostLink({ postId }: { postId: string }) {
  return (
    <Link to="/posts/$postId" params={{ postId }}>
      View Post
    </Link>
  )
}
```

## Core Patterns

### Link with Active States

```tsx
import { Link } from '@tanstack/react-router'

function NavLink() {
  return (
    <Link
      to="/posts"
      activeProps={{ className: 'font-bold' }}
      inactiveProps={{ className: 'text-gray-500' }}
      activeOptions={{ exact: true }}
    >
      Posts
    </Link>
  )
}
```

The `data-status` attribute is also set to `"active"` on active links for CSS-based styling.

`activeOptions` controls matching behavior:

- `exact` (default `false`) — when `true`, only matches the exact path (not children)
- `includeHash` (default `false`) — include hash in active matching
- `includeSearch` (default `true`) — include search params in active matching

Children can receive `isActive` as a render function:

```tsx
<Link to="/posts">
  {({ isActive }) => <span className={isActive ? 'font-bold' : ''}>Posts</span>}
</Link>
```

### Relative Navigation with `from`

Without `from`, navigation resolves from root `/`. To use relative paths like `..`, provide `from`:

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  component: PostComponent,
})

function PostComponent() {
  return (
    <div>
      {/* Relative to current route */}
      <Link from={Route.fullPath} to="..">
        Back to Posts
      </Link>

      {/* "." reloads the current route */}
      <Link from={Route.fullPath} to=".">
        Reload
      </Link>
    </div>
  )
}
```

### useNavigate for Programmatic Navigation

Use `useNavigate` only for side-effect-driven navigation (e.g., after a form submission). For anything the user clicks, prefer `Link`.

```tsx
import { useNavigate } from '@tanstack/react-router'

function CreatePostForm() {
  const navigate = useNavigate({ from: '/posts' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await fetch('/api/posts', { method: 'POST', body: '...' })
    const { id: postId } = await response.json()

    if (response.ok) {
      navigate({ to: '/posts/$postId', params: { postId } })
    }
  }

  return <form onSubmit={handleSubmit}>{/* ... */}</form>
}
```

The `Navigate` component performs an immediate client-side navigation on mount:

```tsx
import { Navigate } from '@tanstack/react-router'

function LegacyRedirect() {
  return <Navigate to="/posts/$postId" params={{ postId: 'my-first-post' }} />
}
```

`router.navigate` is available anywhere you have the router instance, including outside of React.

### Preloading

Strategies: `intent` (hover/touchstart), `viewport` (intersection observer), `render` (on mount).

Set globally:

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 50, // ms, default is 50
})
```

Or per-link:

```tsx
<Link
  to="/posts/$postId"
  params={{ postId }}
  preload="intent"
  preloadDelay={100}
>
  View Post
</Link>
```

Preloaded data stays fresh for 30 seconds by default (`defaultPreloadStaleTime: 30_000`). During that window it won't be refetched. When using an external cache like TanStack Query, set `defaultPreloadStaleTime: 0` to let the external library control freshness.

Manual preloading via the router instance:

```tsx
import { useRouter } from '@tanstack/react-router'

function Component() {
  const router = useRouter()

  useEffect(() => {
    router.preloadRoute({ to: '/posts/$postId', params: { postId: '1' } })
  }, [router])

  return <div />
}
```

### Navigation Blocking

Use `useBlocker` to prevent navigation when a form has unsaved changes:

```tsx
import { useBlocker } from '@tanstack/react-router'
import { useState } from 'react'

function EditForm() {
  const [formIsDirty, setFormIsDirty] = useState(false)

  useBlocker({
    shouldBlockFn: () => {
      if (!formIsDirty) return false
      const shouldLeave = confirm('Are you sure you want to leave?')
      return !shouldLeave
    },
  })

  return <form>{/* ... */}</form>
}
```

With custom UI using `withResolver`:

```tsx
import { useBlocker } from '@tanstack/react-router'
import { useState } from 'react'

function EditForm() {
  const [formIsDirty, setFormIsDirty] = useState(false)

  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => formIsDirty,
    withResolver: true,
  })

  return (
    <>
      <form>{/* ... */}</form>
      {status === 'blocked' && (
        <div>
          <p>Are you sure you want to leave?</p>
          <button onClick={proceed}>Yes</button>
          <button onClick={reset}>No</button>
        </div>
      )}
    </>
  )
}
```

Control `beforeunload` separately:

```tsx
useBlocker({
  shouldBlockFn: () => formIsDirty,
  enableBeforeUnload: formIsDirty,
})
```

### linkOptions for Reusable Navigation Options

`linkOptions` provides eager type-checking on navigation options objects, so errors surface at definition, not at spread-site:

```tsx
import {
  linkOptions,
  Link,
  useNavigate,
  redirect,
} from '@tanstack/react-router'

const dashboardLinkOptions = linkOptions({
  to: '/dashboard',
  search: { search: '' },
})

// Use anywhere: Link, navigate, redirect
function Nav() {
  const navigate = useNavigate()

  return (
    <div>
      <Link {...dashboardLinkOptions}>Dashboard</Link>
      <button onClick={() => navigate(dashboardLinkOptions)}>Go</button>
    </div>
  )
}

// Also works in an array for navigation bars
const navOptions = linkOptions([
  { to: '/dashboard', label: 'Summary', activeOptions: { exact: true } },
  { to: '/dashboard/invoices', label: 'Invoices' },
  { to: '/dashboard/users', label: 'Users' },
])

function NavBar() {
  return (
    <nav>
      {navOptions.map((option) => (
        <Link
          {...option}
          key={option.to}
          activeProps={{ className: 'font-bold' }}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  )
}
```

### createLink for Custom Components

Wraps any component with TanStack Router's type-safe navigation:

```tsx
import * as React from 'react'
import { createLink, LinkComponent } from '@tanstack/react-router'

interface BasicLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

const BasicLinkComponent = React.forwardRef<HTMLAnchorElement, BasicLinkProps>(
  (props, ref) => {
    return <a ref={ref} {...props} className="block px-3 py-2 text-blue-700" />
  },
)

const CreatedLinkComponent = createLink(BasicLinkComponent)

export const CustomLink: LinkComponent<typeof BasicLinkComponent> = (props) => {
  return <CreatedLinkComponent preload="intent" {...props} />
}
```

Usage retains full type safety:

```tsx
<CustomLink to="/dashboard/invoices/$invoiceId" params={{ invoiceId: 0 }} />
```

### Scroll Restoration

Enable globally on the router:

```tsx
const router = createRouter({
  routeTree,
  scrollRestoration: true,
})
```

For nested scrollable areas:

```tsx
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-scrollable-area'],
})
```

Custom cache keys:

```tsx
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  getScrollRestorationKey: (location) => location.pathname,
})
```

Prevent scroll reset for a specific navigation:

```tsx
<Link to="/posts" resetScroll={false}>
  Posts
</Link>
```

### MatchRoute for Pending UI

```tsx
import { Link, MatchRoute } from '@tanstack/react-router'

function Nav() {
  return (
    <Link to="/users">
      Users
      <MatchRoute to="/users" pending>
        <Spinner />
      </MatchRoute>
    </Link>
  )
}
```

## Common Mistakes

### CRITICAL: Interpolating params into the `to` string

```tsx
// WRONG — breaks type safety and param encoding
<Link to={`/posts/${postId}`}>Post</Link>

// CORRECT — use the params option
<Link to="/posts/$postId" params={{ postId }}>Post</Link>
```

Dynamic segments are declared with `$` in the route path. Always pass them via `params`. This applies to `Link`, `useNavigate`, `Navigate`, and `router.navigate`.

### MEDIUM: Using useNavigate for clickable elements

```tsx
// WRONG — no href, no cmd+click, no preloading, no accessibility
function BadNav() {
  const navigate = useNavigate()
  return <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
}

// CORRECT — real <a> tag with href, accessible, preloadable
function GoodNav() {
  return <Link to="/posts">Posts</Link>
}
```

Use `useNavigate` only for programmatic side-effect navigation (after form submit, async action, etc).

### HIGH: Not providing `from` for relative navigation

```tsx
// WRONG — without from, ".." resolves from root
<Link to="..">Back</Link>

// CORRECT — provide from for relative resolution
<Link from={Route.fullPath} to="..">Back</Link>
```

Without `from`, only absolute paths are autocompleted and type-safe. Relative paths like `..` resolve from root instead of the current route.

### HIGH: Using search as object instead of function loses existing params

```tsx
// WRONG — replaces ALL search params with just { page: 2 }
<Link to="." search={{ page: 2 }}>Page 2</Link>

// CORRECT — preserves existing search params, updates page
<Link to="." search={(prev) => ({ ...prev, page: 2 })}>Page 2</Link>
```

When you pass `search` as a plain object, it replaces all search params. Use the function form to spread previous params and selectively update.

---

## Cross-References

- See also: **router-core/search-params/SKILL.md** — Link `search` prop interacts with search param validation
- See also: **router-core/type-safety/SKILL.md** — `from` narrowing improves type inference on Link
