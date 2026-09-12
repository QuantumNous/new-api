---
id: execution-model
title: Execution Model
---

Understanding where code runs is fundamental to building TanStack Start applications. This guide explains TanStack Start's execution model and how to control where your code executes.

## Core Principle: Isomorphic by Default

**All code in TanStack Start is isomorphic by default** - it runs and is included in both server and client bundles unless explicitly constrained.

```tsx
// ✅ This runs on BOTH server and client
function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

// ✅ Route loaders are ISOMORPHIC
export const Route = createFileRoute('/products')({
  loader: async () => {
    // This runs on server during SSR AND on client during navigation
    const response = await fetch('/api/products')
    return response.json()
  },
})
```

> **Critical Understanding**: Route `loader`s are isomorphic - they run on both server and client, not just the server.

## The Execution Boundary

TanStack Start applications run in two environments:

### Server Environment

- **Node.js runtime** with access to file system, databases, environment variables
- **During SSR** - Initial page renders on server
- **API requests** - Server functions execute server-side
- **Build time** - Static generation and pre-rendering

### Client Environment

- **Browser runtime** with access to DOM, localStorage, user interactions
- **After hydration** - Client takes over after initial server render
- **Navigation** - Route loaders run client-side during navigation
- **User interactions** - Event handlers, form submissions, etc.

## Execution Control APIs

### Server-Only Execution

| API                      | Use Case                  | Client Behavior           |
| ------------------------ | ------------------------- | ------------------------- |
| `createServerFn()`       | RPC calls, data mutations | Network request to server |
| `createServerOnlyFn(fn)` | Utility functions         | Throws error              |

```tsx
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

// RPC: Server execution, callable from client
const updateUser = createServerFn({ method: 'POST' })
  .validator((data: UserData) => data)
  .handler(async ({ data }) => {
    // Only runs on server, but client can call it
    return await db.users.update(data)
  })

// Utility: Server-only, client crashes if called
const getEnvVar = createServerOnlyFn(() => process.env.DATABASE_URL)
```

### Client-Only Execution

| API                      | Use Case                        | Server Behavior  |
| ------------------------ | ------------------------------- | ---------------- |
| `createClientOnlyFn(fn)` | Browser utilities               | Throws error     |
| `<ClientOnly>`           | Components needing browser APIs | Renders fallback |

```tsx
import { createClientOnlyFn } from '@tanstack/react-start'
import { ClientOnly } from '@tanstack/react-router'

// Utility: Client-only, server crashes if called
const saveToStorage = createClientOnlyFn((key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value))
})

// Component: Only renders children after hydration
function Analytics() {
  return (
    <ClientOnly fallback={null}>
      <GoogleAnalyticsScript />
    </ClientOnly>
  )
}
```

#### useHydrated Hook

For more granular control over hydration-dependent behavior, use the `useHydrated` hook. It returns a boolean indicating whether the client has been hydrated:

```tsx
import { useHydrated } from '@tanstack/react-router'

function TimeZoneDisplay() {
  const hydrated = useHydrated()
  const timeZone = hydrated
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC'

  return <div>Your timezone: {timeZone}</div>
}
```

**Behavior:**

- **During SSR**: Always returns `false`
- **First client render**: Returns `false`
- **After hydration**: Returns `true` (and stays `true` for all subsequent renders)

This is useful when you need to conditionally render content based on client-side data (like browser timezone, locale, or localStorage) while providing a sensible fallback for server rendering.

### Environment-Specific Implementations

```tsx
import { createIsomorphicFn } from '@tanstack/react-start'

// Different implementation per environment
const getDeviceInfo = createIsomorphicFn()
  .server(() => ({ type: 'server', platform: process.platform }))
  .client(() => ({ type: 'client', userAgent: navigator.userAgent }))
```

## Architectural Patterns

### Progressive Enhancement

Build components that work without JavaScript and enhance with client-side functionality:

```tsx
function SearchForm() {
  const [query, setQuery] = useState('')

  return (
    <form action="/search" method="get">
      <input
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ClientOnly fallback={<button type="submit">Search</button>}>
        <SearchButton onSearch={() => search(query)} />
      </ClientOnly>
    </form>
  )
}
```

### Environment-Aware Storage

```tsx
const storage = createIsomorphicFn()
  .server((key: string) => {
    // Server: File-based cache
    const fs = require('node:fs')
    return JSON.parse(fs.readFileSync('.cache', 'utf-8'))[key]
  })
  .client((key: string) => {
    // Client: localStorage
    return JSON.parse(localStorage.getItem(key) || 'null')
  })
```

### RPC vs Direct Function Calls

Understanding when to use server functions vs server-only functions:

```tsx
// createServerFn: RPC pattern - server execution, client callable
const fetchUser = createServerFn().handler(async () => await db.users.find())

// Usage from client component:
const user = await fetchUser() // ✅ Network request

// createServerOnlyFn: Crashes if called from client
const getSecret = createServerOnlyFn(() => process.env.SECRET)

// Usage from client:
const secret = getSecret() // ❌ Throws error
```

## Common Anti-Patterns

### Module-Level `process.env` Reads

Reading `process.env` at module scope is wrong for **two** reasons, not one:

1. **Security:** the value can be inlined into the client bundle.
2. **Runtime correctness:** on Cloudflare Workers and other edge SSR runtimes, env is injected per-request. Module-level code runs at module load, before the env exists, so the read evaluates to `undefined` even on the server.

```tsx
// ❌ Leaks to client AND is undefined under Worker SSR
const apiKey = process.env.SECRET_KEY

// ✅ Wrap in a server-only function — read happens per call, on the server
const apiKey = createServerOnlyFn(() => process.env.SECRET_KEY)

// ✅ Or read directly inside `.handler()` / middleware `.server()` / server-route handlers
const fetchData = createServerFn().handler(async () => {
  const apiKey = process.env.SECRET_KEY
  // ...
})
```

### Incorrect Loader Assumptions

```tsx
// ❌ Assuming loader is server-only
export const Route = createFileRoute('/users')({
  loader: () => {
    // This runs on BOTH server and client!
    const secret = process.env.SECRET // Exposed to client
    return fetch(`/api/users?key=${secret}`)
  },
})

// ✅ Use server function for server-only operations
const getUsersSecurely = createServerFn().handler(() => {
  const secret = process.env.SECRET // Server-only
  return fetch(`/api/users?key=${secret}`)
})

export const Route = createFileRoute('/users')({
  loader: () => getUsersSecurely(), // Isomorphic call to server function
})
```

### Hydration Mismatches

```tsx
// ❌ Different content server vs client
function CurrentTime() {
  return <div>{new Date().toLocaleString()}</div>
}

// ✅ Consistent rendering
function CurrentTime() {
  const [time, setTime] = useState<string>()

  useEffect(() => {
    setTime(new Date().toLocaleString())
  }, [])

  return <div>{time || 'Loading...'}</div>
}
```

## Manual vs API-Driven Environment Detection

```tsx
// Manual: You handle the logic
function logMessage(msg: string) {
  if (typeof window === 'undefined') {
    console.log(`[SERVER]: ${msg}`)
  } else {
    console.log(`[CLIENT]: ${msg}`)
  }
}

// API: Framework handles it
const logMessage = createIsomorphicFn()
  .server((msg) => console.log(`[SERVER]: ${msg}`))
  .client((msg) => console.log(`[CLIENT]: ${msg}`))
```

## Marking Whole Files Server- or Client-Only

The `.server.*` and `.client.*` filename suffixes opt a file into Start's import protection automatically. When you can't or don't want to rename the file, achieve the same effect with a side-effect import at the top:

```ts
// src/lib/secrets.ts (filename can't be *.server.ts)
import '@tanstack/react-start/server-only'

export function getApiKey() {
  return process.env.API_KEY
}
```

```ts
// src/lib/storage.ts
import '@tanstack/react-start/client-only'

export function savePreferences(prefs: Record<string, string>) {
  localStorage.setItem('prefs', JSON.stringify(prefs))
}
```

Both markers in the same file is an error. Type-only imports are ignored. See the [Import Protection guide](./import-protection.md) for the full reference, including dev vs build behavior, configuring deny rules, and reading violation traces.

## Architecture Decision Framework

**Choose Server-Only when:**

- Accessing sensitive data (environment variables, secrets)
- File system operations
- Database connections
- External API keys

**Choose Client-Only when:**

- DOM manipulation
- Browser APIs (localStorage, geolocation)
- User interaction handling
- Analytics/tracking

**Choose Isomorphic when:**

- Data formatting/transformation
- Business logic
- Shared utilities
- Route loaders (they're isomorphic by nature)

## Security Considerations

### Bundle Analysis

Always verify server-only code isn't included in client bundles:

```bash
# Analyze client bundle
npm run build
# Check dist/client for any server-only imports
```

### Environment Variable Strategy

- **Client-exposed**: Use `VITE_` prefix for client-accessible variables
- **Server-only**: Access via `createServerOnlyFn()` or `createServerFn()`
- **Never expose**: Database URLs, API keys, secrets

### Error Boundaries

Handle server/client execution errors gracefully:

```tsx
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryComponent
      fallback={<div>Something went wrong</div>}
      onError={(error) => {
        if (typeof window === 'undefined') {
          console.error('[SERVER ERROR]:', error)
        } else {
          console.error('[CLIENT ERROR]:', error)
        }
      }}
    >
      {children}
    </ErrorBoundaryComponent>
  )
}
```

Understanding TanStack Start's execution model is crucial for building secure, performant, and maintainable applications. The isomorphic-by-default approach provides flexibility while the execution control APIs give you precise control when needed.
