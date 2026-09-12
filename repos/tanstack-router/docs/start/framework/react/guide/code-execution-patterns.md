---
id: code-execution-patterns
title: Code Execution Patterns
---

This guide covers patterns for controlling where code runs in your TanStack Start application - server-only, client-only, or isomorphic (both environments). For foundational concepts, see the [Execution Model](./execution-model.md) guide.

## Quick Start

Set up execution boundaries in your TanStack Start application:

```tsx
import {
  createServerFn,
  createServerOnlyFn,
  createClientOnlyFn,
  createIsomorphicFn,
} from '@tanstack/react-start'

// Server function (RPC call)
const getUsers = createServerFn().handler(async () => {
  return await db.users.findMany()
})

// Server-only utility (crashes on client)
const getSecret = createServerOnlyFn(() => process.env.API_SECRET)

// Client-only utility (crashes on server)
const saveToStorage = createClientOnlyFn((data: any) => {
  localStorage.setItem('data', JSON.stringify(data))
})

// Different implementations per environment
const logger = createIsomorphicFn()
  .server((msg) => console.log(`[SERVER]: ${msg}`))
  .client((msg) => console.log(`[CLIENT]: ${msg}`))
```

## Implementation Patterns

### Progressive Enhancement

```tsx
// Component works without JS, enhanced with JS
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

## Common Problems

### Environment Variable Exposure

```tsx
// ❌ Exposes to client bundle
const apiKey = process.env.SECRET_KEY

// ✅ Server-only access
const apiKey = createServerOnlyFn(() => process.env.SECRET_KEY)
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

## Production Checklist

- [ ] **Bundle Analysis**: Verify server-only code isn't in client bundle
- [ ] **Environment Variables**: Ensure secrets use `createServerOnlyFn()` or `createServerFn()`
- [ ] **Loader Logic**: Remember loaders are isomorphic, not server-only
- [ ] **ClientOnly Fallbacks**: Provide appropriate fallbacks to prevent layout shift
- [ ] **Error Boundaries**: Handle server/client execution errors gracefully

## Related Resources

- [Execution Model](./execution-model.md) - Core concepts and architectural patterns
- [Server Functions](./server-functions.md) - Deep dive into server function patterns
- [Environment Variables](./environment-variables.md) - Secure environment variable handling
- [Middleware](./middleware.md) - Server function middleware patterns
