---
name: vue-router
description: >-
  Vue bindings for TanStack Router: RouterProvider, useRouter,
  useRouterState, useMatch, useMatches, useLocation, useSearch,
  useParams, useNavigate, useLoaderData, useLoaderDeps,
  useRouteContext, useBlocker, useCanGoBack, Link, Navigate,
  Outlet, CatchBoundary, ErrorComponent, Html, Body.
  Vue-specific patterns with Ref<T> returns, defineComponent,
  h() render functions, provide/inject, and computed refs.
type: framework
library: tanstack-router
library_version: '1.166.2'
framework: vue
requires:
  - router-core
sources:
  - TanStack/router:packages/vue-router/src
---

# Vue Router (`@tanstack/vue-router`)

This skill builds on router-core. Read [router-core](../../../router-core/skills/router-core/SKILL.md) first for foundational concepts.

This skill covers the Vue-specific bindings, components, composables, and setup for TanStack Router.

> **CRITICAL**: TanStack Router types are FULLY INFERRED. Never cast, never annotate inferred values.

> **CRITICAL**: TanStack Router is CLIENT-FIRST. Loaders run on the client by default, not on the server.

> **CRITICAL**: Most composables return `Ref<T>` — access via `.value` in script, auto-unwrapped in templates. This is the #1 difference from the React version.

> **CRITICAL**: Do not confuse `@tanstack/vue-router` with `vue-router` (the official Vue router). They are completely different libraries with different APIs.

## Full Setup: File-Based Routing with Vite

### 1. Install Dependencies

```bash
npm install @tanstack/vue-router
npm install -D @tanstack/router-plugin @vitejs/plugin-vue-jsx
```

### 2. Configure Vite Plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // MUST come before vue()
    tanstackRouter({
      target: 'vue',
      autoCodeSplitting: true,
    }),
    vue(),
    vueJsx(), // Required for JSX/TSX route files
  ],
})
```

### 3. Create Root Route

```tsx
// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from '@tanstack/vue-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <nav>
        <Link to="/" activeProps={{ class: 'font-bold' }}>
          Home
        </Link>
        <Link to="/about" activeProps={{ class: 'font-bold' }}>
          About
        </Link>
      </nav>
      <hr />
      <Outlet />
    </>
  )
}
```

### 4. Create Route Files

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <h1>Welcome Home</h1>
}
```

### 5. Create Router Instance and Register Types

```tsx
// src/main.tsx
import { createApp } from 'vue'
import { RouterProvider, createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

// REQUIRED — without this, Link/useNavigate/useSearch have no type safety
declare module '@tanstack/vue-router' {
  interface Register {
    router: typeof router
  }
}

const app = createApp(RouterProvider, { router })
app.mount('#root')
```

## Composables Reference

All composables imported from `@tanstack/vue-router`. Most return `Ref<T>` — access via `.value` in script or auto-unwrap in templates.

### `useRouter()` — returns `TRouter` (NOT a Ref)

```tsx
import { useRouter } from '@tanstack/vue-router'

const router = useRouter()
router.invalidate()
```

### `useRouterState()` — returns `Ref<T>`

Subscribe to router state changes. Exposes the entire state and thus incurs
a performance cost. For matches or location favor `useMatches` and `useLocation`.

```tsx
import { useRouterState } from '@tanstack/vue-router'

const isLoading = useRouterState({ select: (s) => s.isLoading })
// Access: isLoading.value
```

### `useNavigate()` — returns a function (NOT a Ref)

```tsx
import { useNavigate } from '@tanstack/vue-router'

const navigate = useNavigate()

async function handleSubmit() {
  await saveData()
  navigate({ to: '/posts/$postId', params: { postId: '123' } })
}
```

### `useSearch({ from })` — returns `Ref<T>`

```tsx
import { useSearch } from '@tanstack/vue-router'

const search = useSearch({ from: '/products' })
// Access: search.value.page
```

### `useParams({ from })` — returns `Ref<T>`

```tsx
import { useParams } from '@tanstack/vue-router'

const params = useParams({ from: '/posts/$postId' })
// Access: params.value.postId
```

### `useLoaderData({ from })` — returns `Ref<T>`

```tsx
import { useLoaderData } from '@tanstack/vue-router'

const data = useLoaderData({ from: '/posts/$postId' })
// Access: data.value.post.content
```

### `useMatch({ from })` — returns `Ref<T>`

```tsx
import { useMatch } from '@tanstack/vue-router'

const match = useMatch({ from: '/posts/$postId' })
// Access: match.value.loaderData.post.title
```

### Other Composables

- **`useMatches()`** — `Ref<Array<Match>>`, all active route matches
- **`useRouteContext({ from })`** — `Ref<T>`, context from `beforeLoad`
- **`useBlocker({ shouldBlockFn })`** — blocks navigation for unsaved changes
- **`useCanGoBack()`** — `Ref<boolean>`
- **`useLocation()`** — `Ref<ParsedLocation>`
- **`useLoaderDeps({ from })`** — `Ref<T>`, loader dependency values
- **`useLinkProps()`** — returns `LinkHTMLAttributes`
- **`useMatchRoute()`** — returns a function; calling it returns `Ref<false | Params>`

## Components Reference

### `RouterProvider`

```tsx
import { RouterProvider } from '@tanstack/vue-router'
// In createApp or template
<RouterProvider :router="router" />
```

### `Link`

Type-safe navigation link with scoped slot for active state:

```vue
<Link to="/posts/$postId" :params="{ postId: '42' }">
  View Post
</Link>

<!-- Scoped slot for active state -->
<Link to="/about">
  <template #default="{ isActive }">
    <span :class="{ active: isActive }">About</span>
  </template>
</Link>
```

### `Outlet`

Renders the matched child route component.

### `Navigate`

Declarative redirect (triggers navigation in `onMounted`).

### `Await`

Async setup component for deferred data — use with Vue's `<Suspense>`.

### `CatchBoundary`

Error boundary using Vue's `onErrorCaptured`.

### `Html` and `Body`

Vue-specific SSR shell components:

```tsx
function RootComponent() {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
        <Outlet />
        <Scripts />
      </Body>
    </Html>
  )
}
```

### `ClientOnly`

Renders children only after `onMounted` (hydration complete):

```tsx
<ClientOnly fallback={<div>Loading...</div>}>
  <BrowserOnlyWidget />
</ClientOnly>
```

## Vue-Specific Patterns

### Custom Link Component with `createLink`

```tsx
import { createLink } from '@tanstack/vue-router'
import { defineComponent, h } from 'vue'

const StyledLinkComponent = defineComponent({
  setup(props, { slots, attrs }) {
    return () => h('a', { ...attrs, class: 'styled-link' }, slots.default?.())
  },
})

const StyledLink = createLink(StyledLinkComponent)
```

### Render Functions (h())

All components in `@tanstack/vue-router` use `h()` render functions internally. Route components can use either SFC templates or render functions:

SFC template (most common for user code) in `MyRoute.component.vue`:

```vue
<template>
  <div>{{ data.title }}</div>
</template>

<script setup>
import { useLoaderData } from '@tanstack/vue-router'
const data = useLoaderData({ from: '/posts/$postId' })
</script>
```

### Auth with Router Context

```tsx
import { createRootRouteWithContext } from '@tanstack/vue-router'

const rootRoute = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootComponent,
})

const router = createRouter({
  routeTree,
  context: { auth: authState },
})

// In a route — access via beforeLoad
beforeLoad: ({ context }) => {
  if (!context.auth.isAuthenticated) {
    throw redirect({ to: '/login' })
  }
}
```

### Vue File Conventions for Code Splitting

With `autoCodeSplitting`, Vue routes can optionally use split-file conventions. These are NOT required — single-file `.tsx` routes work fine. Split files are useful for separating route config from components:

- `myRoute.ts` — route configuration (search params, loader, beforeLoad)
- `myRoute.component.vue` — route component (lazy-loaded)
- `myRoute.errorComponent.vue` — error component (lazy-loaded)
- `myRoute.notFoundComponent.vue` — not-found component (lazy-loaded)
- `myRoute.lazy.ts` — lazy-loaded route options

## Common Mistakes

### 1. CRITICAL: Forgetting .value in script blocks

Composables return `Ref<T>` — access via `.value` in `<script>`. Templates auto-unwrap.

```tsx
// WRONG — accessing Ref without .value in script
const params = useParams({ from: '/posts/$postId' })
console.log(params.postId) // undefined!

// CORRECT — use .value
const params = useParams({ from: '/posts/$postId' })
console.log(params.value.postId)
```

### 2. HIGH: Confusing with vue-router (official)

`@tanstack/vue-router` is NOT `vue-router`. Do not use `<router-view>`, `<router-link>`, `useRoute()`, `useRouter()` from `vue-router`.

```ts
// WRONG — official vue-router imports
import { useRoute, useRouter } from 'vue-router'

// CORRECT — TanStack Vue Router imports
import { useMatch, useRouter } from '@tanstack/vue-router'
```

### 3. HIGH: Using Vue hooks in beforeLoad or loader

`beforeLoad` and `loader` are NOT component setup functions — they are plain async functions. Vue composables cannot be used in them. Pass state via router context instead.

### 4. MEDIUM: Wrong plugin target

Must set `target: 'vue'` in the router plugin config. Default is `'react'`.

## Cross-References

- [router-core/SKILL.md](../../../router-core/skills/router-core/SKILL.md) — all sub-skills for domain-specific patterns (search params, data loading, navigation, auth, SSR, etc.)
