---
id: hydration-errors
title: Hydration Errors
---

### Why it happens

- **Mismatch**: Server HTML differs from client render during hydration
- **Common causes**: `Intl` (locale/time zone), `Date.now()`, random IDs, responsive-only logic, feature flags, user prefs

### Strategy 1 — Make server and client match

- **Pick a deterministic locale/time zone on the server** and use the same on the client
- **Source of truth**: cookie (preferred) or `Accept-Language` header
- **Compute once on the server** and hydrate as initial state

```tsx
// src/start.ts
import { createStart, createMiddleware } from '@tanstack/solid-start'
import {
  getRequestHeader,
  getCookie,
  setCookie,
} from '@tanstack/solid-start/server'

const localeTzMiddleware = createMiddleware().server(async ({ next }) => {
  const header = getRequestHeader('accept-language')
  const headerLocale = header?.split(',')[0] || 'en-US'
  const cookieLocale = getCookie('locale')
  const cookieTz = getCookie('tz') // set by client later (see Strategy 2)

  const locale = cookieLocale || headerLocale
  const timeZone = cookieTz || 'UTC'

  setCookie('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })

  return next({ context: { locale, timeZone } })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [localeTzMiddleware],
}))
```

```tsx
// src/routes/index.tsx (example)
import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { getCookie } from '@tanstack/solid-start/server'

export const getServerNow = createServerFn().handler(async () => {
  const locale = getCookie('locale') || 'en-US'
  const timeZone = getCookie('tz') || 'UTC'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date())
})

export const Route = createFileRoute('/')({
  loader: () => getServerNow(),
  component: () => {
    const serverNow = Route.useLoaderData() as string
    return <time dateTime={serverNow}>{serverNow}</time>
  },
})
```

### Strategy 2 — Let the client tell you its environment

- On first visit, set a cookie with the client time zone; SSR uses `UTC` until then

```tsx
import { ClientOnly } from '@tanstack/solid-router'

function SetTimeZoneCookie() {
  if (typeof window !== 'undefined') {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    document.cookie = `tz=${tz}; path=/; max-age=31536000`
  }
  return null
}

;<ClientOnly fallback={null}>
  <SetTimeZoneCookie />
</ClientOnly>
```

### Strategy 3 — Make it client-only

- Use `<ClientOnly>` or Solid’s `<NoHydration>` to avoid SSR/hydration

```tsx
import { ClientOnly } from '@tanstack/solid-router'
import { NoHydration } from 'solid-js/web'

<ClientOnly fallback={<span>—</span>}>
  <RelativeTime ts={someTs} />
</ClientOnly>

<NoHydration>
  <time>{new Date().toLocaleString()}</time>
</NoHydration>
```

### Strategy 4 — Disable or limit SSR for the route

- Use Selective SSR to avoid rendering the component on the server

```tsx
export const Route = createFileRoute('/unstable')({
  ssr: 'data-only', // or false
  component: () => <ExpensiveViz />,
})
```

### Strategy 5 — Last resort suppression

- Prefer the tools above; avoid mismatches instead of hiding them

### Checklist

- **Deterministic inputs**: locale, time zone, feature flags
- **Prefer cookies** for client context; fallback to `Accept-Language`
- **Use `<ClientOnly>`/`<NoHydration>`** for inherently dynamic UI
- **Use Selective SSR** when server HTML cannot be stable

See also: [Execution Model](./execution-model.md), [Code Execution Patterns](./code-execution-patterns.md), [Selective SSR](./selective-ssr.md), [Server Functions](./server-functions.md)
