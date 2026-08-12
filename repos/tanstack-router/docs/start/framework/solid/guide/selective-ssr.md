---
id: selective-ssr
title: Selective Server-Side Rendering (SSR)
---

## What is Selective SSR?

In TanStack Start, routes matching the initial request are rendered on the server by default. This means `beforeLoad` and `loader` are executed on the server, followed by rendering the route components. The resulting HTML is sent to the client, which hydrates the markup into a fully interactive application.

However, there are cases where you might want to disable SSR for certain routes or all routes, such as:

- When `beforeLoad` or `loader` requires browser-only APIs (e.g., `localStorage`).
- When the route component depends on browser-only APIs (e.g., `canvas`).

TanStack Start's Selective SSR feature lets you configure:

- Which routes should execute `beforeLoad` or `loader` on the server.
- Which route components should be rendered on the server.

## How does this compare to SPA mode?

TanStack Start's [SPA mode](./spa-mode) completely disables server-side execution of `beforeLoad` and `loader`, as well as server-side rendering of route components. Selective SSR allows you to configure server-side handling on a per-route basis, either statically or dynamically.

## Configuration

You can control how a route is handled during the initial server request using the `ssr` property. If this property is not set, it defaults to `true`. You can change this default using the `defaultSsr` option in `createStart`:

```tsx
// src/start.ts
import { createStart } from '@tanstack/solid-start'

export const startInstance = createStart(() => ({
  // Disable SSR by default
  defaultSsr: false,
}))
```

### `ssr: true`

This is the default behavior unless otherwise configured. On the initial request, it will:

- Run `beforeLoad` on the server and send the resulting context to the client.
- Run `loader` on the server and send the loader data to the client.
- Render the component on the server and send the HTML markup to the client.

```tsx
// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  ssr: true,
  beforeLoad: () => {
    console.log('Executes on the server during the initial request')
    console.log('Executes on the client for subsequent navigation')
  },
  loader: () => {
    console.log('Executes on the server during the initial request')
    console.log('Executes on the client for subsequent navigation')
  },
  component: () => <div>This component is rendered on the server</div>,
})
```

### `ssr: false`

This disables server-side:

- Execution of the route's `beforeLoad` and `loader`.
- Rendering of the route component.

```tsx
// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  ssr: false,
  beforeLoad: () => {
    console.log('Executes on the client during hydration')
  },
  loader: () => {
    console.log('Executes on the client during hydration')
  },
  component: () => <div>This component is rendered on the client</div>,
})
```

### `ssr: 'data-only'`

This hybrid option will:

- Run `beforeLoad` on the server and send the resulting context to the client.
- Run `loader` on the server and send the loader data to the client.
- Disable server-side rendering of the route component.

```tsx
// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  ssr: 'data-only',
  beforeLoad: () => {
    console.log('Executes on the server during the initial request')
    console.log('Executes on the client for subsequent navigation')
  },
  loader: () => {
    console.log('Executes on the server during the initial request')
    console.log('Executes on the client for subsequent navigation')
  },
  component: () => <div>This component is rendered on the client</div>,
})
```

### Functional Form

For more flexibility, you can use the functional form of the `ssr` property to decide at runtime whether to SSR a route:

```tsx
// src/routes/docs/$docType/$docId.tsx
export const Route = createFileRoute('/docs/$docType/$docId')({
  validateSearch: z.object({ details: z.boolean().optional() }),
  ssr: ({ params, search }) => {
    if (params.status === 'success' && params.value.docType === 'sheet') {
      return false
    }
    if (search.status === 'success' && search.value.details) {
      return 'data-only'
    }
  },
  beforeLoad: () => {
    console.log('Executes on the server depending on the result of ssr()')
  },
  loader: () => {
    console.log('Executes on the server depending on the result of ssr()')
  },
  component: () => <div>This component is rendered on the client</div>,
})
```

The `ssr` function runs only on the server during the initial request and is stripped from the client bundle.

`search` and `params` are passed in after validation as a discriminated union:

```tsx
params:
    | { status: 'success'; value: Expand<ResolveAllParamsFromParent<TParentRoute, TParams>> }
    | { status: 'error'; error: unknown }
search:
    | { status: 'success'; value: Expand<ResolveFullSearchSchema<TParentRoute, TSearchValidator>> }
    | { status: 'error'; error: unknown }
```

If validation fails, `status` will be `error` and `error` will contain the failure details. Otherwise, `status` will be `success` and `value` will contain the validated data.

### Inheritance

At runtime, a child route inherits the Selective SSR configuration of its parent. However, the inherited value can only be changed to be more restrictive (i.e. `true` to `data-only` or `false` and `data-only` to `false`). For example:

```tsx
root { ssr: undefined }
  posts { ssr: false }
     $postId { ssr: true }
```

- `root` defaults to `ssr: true`.
- `posts` explicitly sets `ssr: false`, so neither `beforeLoad` nor `loader` will run on the server, and the route component won't be rendered on the server.
- `$postId` sets `ssr: true`, but inherits `ssr: false` from its parent. Because the inherited value can only be changed to be more restrictive, `ssr: true` has no effect and the inherited `ssr: false` will remain.

Another example:

```tsx
root { ssr: undefined }
  posts { ssr: 'data-only' }
     $postId { ssr: true }
       details { ssr: false }
```

- `root` defaults to `ssr: true`.
- `posts` sets `ssr: 'data-only'`, so `beforeLoad` and `loader` run on the server, but the route component isn't rendered on the server.
- `$postId` sets `ssr: true`, but inherits `ssr: 'data-only'` from its parent.
- `details` sets `ssr: false`, so neither `beforeLoad` nor `loader` will run on the server, and the route component won't be rendered on the server. Here the inherited value is changed to be more restrictive, and therefore, the `ssr: false` will override the inherited value.

## Fallback Rendering

For the first route with `ssr: false` or `ssr: 'data-only'`, the server will render the route's `pendingComponent` as a fallback. If `pendingComponent` isn't configured, the `defaultPendingComponent` will be rendered. If neither is configured, no fallback will be rendered.

On the client during hydration, this fallback will be displayed for at least `minPendingMs` (or `defaultPendingMinMs` if not configured), even if the route doesn't have `beforeLoad` or `loader` defined.

## How to disable SSR of the root route?

You can disable server side rendering of the root route component, however the `<html>` shell still needs to be rendered on the server. This shell is configured via the `shellComponent` property and takes a single property `children`. The `shellComponent` is always SSRed and is wrapping around the root `component`, the root `errorComponent` or the root `notFound` component respectively.

A minimal setup of a root route with disabled SSR for the route component looks like this:

```tsx
import * as Solid from 'solid-js'

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/solid-router'

export const Route = createRootRoute({
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: () => <div>Error</div>,
  notFoundComponent: () => <div>Not found</div>,
  ssr: false, // or `defaultSsr: false` on the router
})

function RootShell(props) {
  return (
    <HeadContent />
    {props.children}
    <Scripts />
  )
}

function RootComponent() {
  return (
    <div>
      <h1>This component will be rendered on the client</h1>
      <Outlet />
    </div>
  )
}
```
