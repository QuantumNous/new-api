---
id: create-route-property-order
title: Ensure correct order of inference sensitive properties for createRoute functions
---

For the following functions, the property order of the passed in object matters due to type inference:

- `createRoute`
- `createFileRoute`
- `createRootRoute`
- `createRootRouteWithContext`

The correct property order is as follows

- `params`, `validateSearch`
- `loaderDeps`, `search.middlewares`, `ssr`
- `context`
- `beforeLoad`
- `loader`
- `onEnter`, `onStay`, `onLeave`, `head`, `scripts`, `headers`, `remountDeps`

All other properties are insensitive to the order as they do not depend on type inference.

## Rule Details

Examples of **incorrect** code for this rule:

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/path.tsx"
/* eslint "@tanstack/router/create-route-property-order": "warn" */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/path')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getQueryOptions(context.hello))
  },
  beforeLoad: () => ({ hello: 'world' }),
})
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/path.tsx"
/* eslint "@tanstack/router/create-route-property-order": "warn" */
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/path')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getQueryOptions(context.hello))
  },
  beforeLoad: () => ({ hello: 'world' }),
})
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

Examples of **correct** code for this rule:

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/path.tsx"
/* eslint "@tanstack/router/create-route-property-order": "warn" */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/path')({
  beforeLoad: () => ({ hello: 'world' }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getQueryOptions(context.hello))
  },
})
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/path.tsx"
/* eslint "@tanstack/router/create-route-property-order": "warn" */
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/path')({
  beforeLoad: () => ({ hello: 'world' }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getQueryOptions(context.hello))
  },
})
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

## Attributes

- [x] ✅ Recommended
- [x] 🔧 Fixable
