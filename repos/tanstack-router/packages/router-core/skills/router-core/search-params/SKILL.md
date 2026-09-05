---
name: router-core/search-params
description: >-
  validateSearch, search param validation with Zod/Valibot/ArkType adapters,
  fallback(), search middlewares (retainSearchParams, stripSearchParams),
  custom serialization (parseSearch, stringifySearch), search param
  inheritance, loaderDeps for cache keys, reading and writing search params.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/search-params.md
  - TanStack/router:docs/router/how-to/setup-basic-search-params.md
  - TanStack/router:docs/router/how-to/validate-search-params.md
  - TanStack/router:docs/router/how-to/navigate-with-search-params.md
  - TanStack/router:docs/router/how-to/share-search-params-across-routes.md
  - TanStack/router:docs/router/guide/custom-search-param-serialization.md
---

# Search Params

TanStack Router treats search params as JSON-first application state. They are automatically parsed from the URL into structured objects (numbers, booleans, arrays, nested objects) and validated via `validateSearch` on each route.

> **CRITICAL**: When using `zodValidator()` and Zod v3, use `fallback()` from `@tanstack/zod-adapter`, NOT zod's `.catch()`. Using `.catch()` with the zod adapter makes the output type `unknown`, destroying type safety. This does not apply to Valibot or ArkType (which use their own fallback mechanisms). It also does not apply to Zod v4, which should use `.catch()` and not use the `zodValidator()`.
> **CRITICAL**: Types are fully inferred. Never annotate the return of `useSearch()`.

## Setup: Zod Adapter (Recommended)

```bash
npm install zod @tanstack/zod-adapter
```

```tsx
// src/routes/products.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const productSearchSchema = z.object({
  page: z.number().default(1).catch(1),
  filter: z.string().default(''),
  sort: z.enum(['newest', 'oldest', 'price']).default('newest').catch('newest'),
})

export const Route = createFileRoute('/products')({
  validateSearch: productSearchSchema,
  component: ProductsPage,
})

function ProductsPage() {
  // page: number, filter: string, sort: 'newest' | 'oldest' | 'price'
  // ALL INFERRED — do not annotate
  const { page, filter, sort } = Route.useSearch()

  return (
    <div>
      <p>
        Page {page}, filter: {filter}, sort: {sort}
      </p>
    </div>
  )
}
```

## Reading Search Params

### In Route Components: `Route.useSearch()`

```tsx
function ProductsPage() {
  const { page, sort } = Route.useSearch()
  return <div>Page {page}</div>
}
```

### In Code-Split Components: `getRouteApi()`

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/products')

function ProductFilters() {
  const { sort } = routeApi.useSearch()
  return <select value={sort}>{/* options */}</select>
}
```

### From Any Component: `useSearch({ from })`

```tsx
import { useSearch } from '@tanstack/react-router'

function SortIndicator() {
  const { sort } = useSearch({ from: '/products' })
  return <span>Sorted by: {sort}</span>
}
```

### Loose Access: `useSearch({ strict: false })`

```tsx
function GenericPaginator() {
  const search = useSearch({ strict: false })
  // search.page is number | undefined (union of all routes)
  return <span>Page: {search.page ?? 1}</span>
}
```

## Writing Search Params

### Link with Function Form (Preserves Existing Params)

```tsx
import { Link } from '@tanstack/react-router'

function Pagination() {
  return (
    <Link
      from="/products"
      search={(prev) => ({ ...prev, page: prev.page + 1 })}
    >
      Next Page
    </Link>
  )
}
```

### Link with Object Form (Replaces All Params)

```tsx
<Link to="/products" search={{ page: 1, filter: '', sort: 'newest' }}>
  Reset
</Link>
```

### Programmatic: `useNavigate()`

```tsx
import { useNavigate } from '@tanstack/react-router'

function SortDropdown() {
  const navigate = useNavigate({ from: '/products' })

  return (
    <select
      onChange={(e) => {
        navigate({
          search: (prev) => ({ ...prev, sort: e.target.value, page: 1 }),
        })
      }}
    >
      <option value="newest">Newest</option>
      <option value="price">Price</option>
    </select>
  )
}
```

## Search Param Inheritance

Parent route search params are automatically merged into child routes:

```tsx
// src/routes/shop.tsx — parent defines shared params
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const shopSearchSchema = z.object({
  currency: z.enum(['USD', 'EUR']).default('USD').catch('USD'),
})

export const Route = createFileRoute('/shop')({
  validateSearch: shopSearchSchema,
})
```

```tsx
// src/routes/shop/products.tsx — child inherits currency
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/shop/products')({
  component: ShopProducts,
})

function ShopProducts() {
  // currency is available here from parent — fully typed
  const { currency } = Route.useSearch()
  return <div>Currency: {currency}</div>
}
```

## Search Middlewares

### `retainSearchParams` — Keep Params Across Navigation

```tsx
import { createRootRoute, retainSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

const rootSearchSchema = z.object({
  debug: z.boolean().optional(),
})

export const Route = createRootRoute({
  validateSearch: rootSearchSchema,
  search: {
    middlewares: [retainSearchParams(['debug'])],
  },
})
```

### `stripSearchParams` — Remove Default Values from URL

```tsx
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

const defaults = { sort: 'newest', page: 1 }

const searchSchema = z.object({
  sort: z.string().default(defaults.sort),
  page: z.number().default(defaults.page),
})

export const Route = createFileRoute('/items')({
  validateSearch: searchSchema,
  search: {
    middlewares: [stripSearchParams(defaults)],
  },
})
```

### Chaining Middlewares

```tsx
export const Route = createFileRoute('/search')({
  validateSearch: z.object({
    retainMe: z.string().optional(),
    arrayWithDefaults: z.string().array().default(['foo', 'bar']),
    required: z.string(),
  }),
  search: {
    middlewares: [
      retainSearchParams(['retainMe']),
      stripSearchParams({ arrayWithDefaults: ['foo', 'bar'] }),
    ],
  },
})
```

## Custom Serialization

Override the default JSON serialization at the router level:

```tsx
import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'

const router = createRouter({
  routeTree,
  // Example: use JSURL2 for compact, human-readable URLs
  parseSearch: parseSearchWith(parse),
  stringifySearch: stringifySearchWith(stringify),
})
```

## Using Search Params in Loaders via `loaderDeps`

```tsx
export const Route = createFileRoute('/products')({
  validateSearch: productSearchSchema,
  // Pick ONLY the params the loader needs — not the entire search object
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ deps }) => {
    return fetchProducts({ page: deps.page })
  },
})
```

## Common Mistakes

### 1. HIGH: Using zod v3's `.catch()` with `zodValidator()` instead of adapter `fallback()`

```tsx
// WRONG — .catch() with zodValidator makes the type unknown
const schema = z.object({ page: z.number().catch(1) })
validateSearch: zodValidator(schema) // page is typed as unknown!

// CORRECT — fallback() preserves the inferred type
import { fallback } from '@tanstack/zod-adapter'
const schema = z.object({ page: fallback(z.number(), 1) })
```

**Important:** This only applies when using Zod v3, not when using Zod v4. For v4, using `.catch()` is correct.

### 2. HIGH: Returning entire search object from `loaderDeps`

```tsx
// WRONG — loader re-runs on ANY search param change
loaderDeps: ({ search }) => search

// CORRECT — loader only re-runs when page changes
loaderDeps: ({ search }) => ({ page: search.page })
```

### 3. HIGH: Passing Date objects in search params

```tsx
// WRONG — Date does not serialize correctly to JSON in URLs
<Link search={{ startDate: new Date() }}>

// CORRECT — convert to ISO string
<Link search={{ startDate: new Date().toISOString() }}>
```

### 4. MEDIUM: Parent route missing `validateSearch` blocks inheritance

```tsx
// WRONG — child cannot access shared params
export const Route = createRootRoute({
  component: RootComponent,
  // no validateSearch!
})

// CORRECT — parent must define validateSearch for children to inherit
export const Route = createRootRoute({
  validateSearch: globalSearchSchema,
  component: RootComponent,
})
```

### 5. HIGH (cross-skill): Using search as object instead of function loses params

```tsx
// WRONG — replaces ALL search params, losing any existing ones
<Link to="." search={{ page: 2 }}>Page 2</Link>

// CORRECT — preserves existing params, updates only page
<Link to="." search={(prev) => ({ ...prev, page: 2 })}>Page 2</Link>
```

## References

- [Validation Patterns Reference](./references/validation-patterns.md) — comprehensive patterns for all validation libraries
