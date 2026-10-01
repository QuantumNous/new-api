---
title: Static Route Data
---

When creating routes, you can optionally specify a `staticData` property in the route's options. This object can literally contain anything you want as long as it's synchronously available when you create your route.

In addition to being able to access this data from the route itself, you can also access it from any match under the `match.staticData` property.

## Example

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/posts.tsx'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  staticData: {
    customData: 'Hello!',
  },
})
```

<!-- ::end:tabs -->

You can then access this data anywhere you have access to your routes, including matches that can be mapped back to their routes.

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/__root.tsx'
import { createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => {
    const matches = useMatches()

    return (
      <div>
        {matches.map((match) => {
          return <div key={match.id}>{match.staticData.customData}</div>
        })}
      </div>
    )
  },
})
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/posts.tsx'
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts')({
  staticData: {
    customData: 'Hello!',
  },
})
```

<!-- ::end:tabs -->

You can then access this data anywhere you have access to your routes, including matches that can be mapped back to their routes.

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/__root.tsx'
import { createRootRoute, useMatches } from '@tanstack/solid-router'
import { For } from 'solid-js'

export const Route = createRootRoute({
  component: () => {
    const matches = useMatches()

    return (
      <div>
        <For each={matches()}>
          {(match) => <div>{match.staticData.customData}</div>}
        </For>
      </div>
    )
  },
})
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

## Enforcing Static Data

If you want to enforce that a route has static data, you can use declaration merging to add a type to the route's static option:

<!-- ::start:framework -->

# React

```tsx
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    customData: string
  }
}
```

# Solid

```tsx
declare module '@tanstack/solid-router' {
  interface StaticDataRouteOption {
    customData: string
  }
}
```

<!-- ::end:framework -->

Now, if you try to create a route without the `customData` property, you'll get a type error:

```tsx
export const Route = createFileRoute('/posts')({
  staticData: {
    // Property 'customData' is missing in type '{ customData: number; }' but required in type 'StaticDataRouteOption'.ts(2741)
  },
})
```

## Optional Static Data

If you want to make static data optional, simply add a `?` to the property:

<!-- ::start:framework -->

# React

```tsx
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    customData?: string
  }
}
```

# Solid

```tsx
declare module '@tanstack/solid-router' {
  interface StaticDataRouteOption {
    customData?: string
  }
}
```

<!-- ::end:framework -->

As long as there are any required properties on the `StaticDataRouteOption`, you'll be required to pass in an object.

## Common Patterns

### Controlling Layout Visibility

Use staticData to control which routes show or hide layout elements:

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/admin/route.tsx'
export const Route = createFileRoute('/admin')({
  staticData: { showNavbar: false },
  component: AdminLayout,
})
```

<!-- ::end:tabs -->

<!-- ::start:tabs variant="files" -->

```tsx
// routes/__root.tsx
function RootComponent() {
  const showNavbar = useMatches({
    select: (matches) =>
      !matches.some((m) => m.staticData?.showNavbar === false),
  })

  return showNavbar ? (
    <Navbar>
      <Outlet />
    </Navbar>
  ) : (
    <Outlet />
  )
}
```

<!-- ::end:tabs -->

### Route Titles for Breadcrumbs

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/posts/$postId.tsx'
export const Route = createFileRoute('/posts/$postId')({
  staticData: {
    getTitle: () => 'Post Details',
  },
})
```

<!-- ::end:tabs -->

<!-- ::start:tabs variant="files" -->

```tsx title='src/components/Breadcrumbs.tsx'
function Breadcrumbs() {
  const matches = useMatches()

  return (
    <nav>
      {matches
        .filter((m) => m.staticData?.getTitle)
        .map((m) => (
          <span key={m.id}>{m.staticData.getTitle()}</span>
        ))}
    </nav>
  )
}
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title='src/routes/posts/$postId.tsx'
export const Route = createFileRoute('/posts/$postId')({
  staticData: {
    getTitle: () => 'Post Details',
  },
})
```

<!-- ::end:tabs -->

<!-- ::start:tabs variant="files" -->

```tsx title='src/components/Breadcrumbs.tsx'
import { useMatches } from '@tanstack/solid-router'
import { For } from 'solid-js'

function Breadcrumbs() {
  const matches = useMatches()

  return (
    <nav>
      <For each={matches().filter((m) => m.staticData?.getTitle)}>
        {(m) => <span>{m.staticData.getTitle()}</span>}
      </For>
    </nav>
  )
}
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

### When to Use staticData vs Context

| staticData                             | context                         |
| -------------------------------------- | ------------------------------- |
| Synchronous, defined at route creation | Can be async (via `beforeLoad`) |
| Available before loading starts        | Can depend on params/search     |
| Same for all instances of a route      | Passed down to child routes     |

Use staticData for static route metadata. Use context for dynamic data or auth state that varies per request.
