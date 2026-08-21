# Search Param Validation Patterns Reference

Comprehensive validation patterns for TanStack Router search params across all supported validation approaches.

## Zod with `@tanstack/zod-adapter`

Zod v3 does not implement Standard Schema, so the `@tanstack/zod-adapter` wrapper is required. Always use `fallback()` from the adapter instead of zod's `.catch()`. Always wrap with `zodValidator()`.

### Basic Types

```tsx
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

const schema = z.object({
  count: fallback(z.number(), 0),
  name: fallback(z.string(), ''),
  active: fallback(z.boolean(), true),
})

export const Route = createFileRoute('/example')({
  validateSearch: zodValidator(schema),
})
```

### Optional Params

```tsx
const schema = z.object({
  // Truly optional — can be undefined in component
  searchTerm: z.string().optional(),
  // Optional in URL but always has a value in component
  page: fallback(z.number(), 1).default(1),
})
```

### Default Values

```tsx
const schema = z.object({
  // .default() means the param is optional during navigation
  // but always present (with default) when reading
  page: fallback(z.number(), 1).default(1),
  sort: fallback(z.enum(['name', 'date', 'price']), 'name').default('name'),
  ascending: fallback(z.boolean(), true).default(true),
})
```

### Array Params

```tsx
const schema = z.object({
  tags: fallback(z.string().array(), []).default([]),
  selectedIds: fallback(z.number().array(), []).default([]),
})

// URL: /items?tags=%5B%22react%22%2C%22typescript%22%5D&selectedIds=%5B1%2C2%2C3%5D
// Parsed: { tags: ['react', 'typescript'], selectedIds: [1, 2, 3] }
```

### Nested Object Params

```tsx
const schema = z.object({
  filters: fallback(
    z.object({
      status: z.enum(['active', 'inactive']).optional(),
      tags: z.string().array().optional(),
      priceRange: z
        .object({
          min: z.number().min(0),
          max: z.number().min(0),
        })
        .optional(),
    }),
    {},
  ).default({}),
})
```

### Enum with Constraints

```tsx
const schema = z.object({
  sort: fallback(z.enum(['newest', 'oldest', 'price']), 'newest').default(
    'newest',
  ),
  page: fallback(z.number().int().min(1).max(1000), 1).default(1),
  limit: fallback(z.number().int().min(10).max(100), 20).default(20),
})
```

### Discriminated Union

```tsx
const schema = z.object({
  searchType: fallback(z.enum(['basic', 'advanced']), 'basic').default('basic'),
  query: fallback(z.string(), '').default(''),
  // Advanced-only fields are optional
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
})
```

For true discriminated union validation:

```tsx
const basicSearch = z.object({
  searchType: z.literal('basic'),
  query: z.string(),
})

const advancedSearch = z.object({
  searchType: z.literal('advanced'),
  query: z.string(),
  category: z.string(),
  minPrice: z.number(),
  maxPrice: z.number(),
})

const schema = z.discriminatedUnion('searchType', [basicSearch, advancedSearch])

export const Route = createFileRoute('/search')({
  validateSearch: zodValidator(schema),
})
```

### Input Transforms (String to Number)

When using the zod adapter with transforms, configure `input` and `output` types:

```tsx
const schema = z.object({
  page: fallback(z.number(), 1).default(1),
  filter: fallback(z.string(), '').default(''),
})

export const Route = createFileRoute('/items')({
  // Default: input type used for navigation, output type used for reading
  validateSearch: zodValidator(schema),

  // Advanced: swap input/output inference
  // validateSearch: zodValidator({ schema, input: 'output', output: 'input' }),
})
```

### Schema Composition

```tsx
const paginationSchema = z.object({
  page: fallback(z.number().int().positive(), 1).default(1),
  limit: fallback(z.number().int().min(1).max(100), 20).default(20),
})

const sortSchema = z.object({
  sortBy: z.enum(['name', 'date', 'relevance']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

// Compose for specific routes
const productSearchSchema = paginationSchema.extend({
  category: z.string().optional(),
  inStock: fallback(z.boolean(), true).default(true),
})

const userSearchSchema = paginationSchema.merge(sortSchema).extend({
  role: z.enum(['admin', 'user']).optional(),
})
```

---

## Valibot (Standard Schema)

Valibot 1.0+ implements Standard Schema. No adapter wrapper needed — pass the schema directly to `validateSearch`. The `@tanstack/valibot-adapter` is optional and only needed for explicit input/output type control.

```bash
npm install valibot
```

```tsx
import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'

const productSearchSchema = v.object({
  page: v.optional(v.fallback(v.number(), 1), 1),
  filter: v.optional(v.fallback(v.string(), ''), ''),
  sort: v.optional(
    v.fallback(v.picklist(['newest', 'oldest', 'price']), 'newest'),
    'newest',
  ),
})

export const Route = createFileRoute('/products')({
  // Pass schema directly — Standard Schema compliant
  validateSearch: productSearchSchema,
  component: ProductsPage,
})

function ProductsPage() {
  const { page, filter, sort } = Route.useSearch()
  return <div>Page {page}</div>
}
```

### Valibot with Constraints

```tsx
import * as v from 'valibot'

const schema = v.object({
  page: v.optional(
    v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
    1,
  ),
  query: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
  tags: v.optional(v.fallback(v.array(v.string()), []), []),
})
```

### Valibot with Adapter (Alternative)

If you need explicit input/output type control:

```tsx
import { valibotValidator } from '@tanstack/valibot-adapter'
import * as v from 'valibot'

const schema = v.object({
  page: v.optional(v.fallback(v.number(), 1), 1),
})

export const Route = createFileRoute('/items')({
  validateSearch: valibotValidator(schema),
})
```

---

## ArkType (Standard Schema)

ArkType 2.0-rc+ implements Standard Schema. No adapter needed — pass the type directly to `validateSearch`. The `@tanstack/arktype-adapter` is optional and only needed for explicit input/output type control.

```bash
npm install arktype
```

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { type } from 'arktype'

const productSearchSchema = type({
  page: 'number = 1',
  filter: 'string = ""',
  sort: '"newest" | "oldest" | "price" = "newest"',
})

export const Route = createFileRoute('/products')({
  // Pass directly — Standard Schema compliant
  validateSearch: productSearchSchema,
  component: ProductsPage,
})

function ProductsPage() {
  const { page, filter, sort } = Route.useSearch()
  return <div>Page {page}</div>
}
```

### ArkType with Constraints

```tsx
import { type } from 'arktype'

const searchSchema = type({
  'query?': 'string>0&<=100',
  page: 'number>0 = 1',
  'sortBy?': "'name'|'date'|'relevance'",
  'filters?': 'string[]',
})
```

---

## Manual Validation Function

For full control without any library. The function receives raw JSON-parsed (but unvalidated) search params.

```tsx
import { createFileRoute } from '@tanstack/react-router'

type ProductSearch = {
  page: number
  filter: string
  sort: 'newest' | 'oldest' | 'price'
}

export const Route = createFileRoute('/products')({
  validateSearch: (search: Record<string, unknown>): ProductSearch => ({
    page: Number(search?.page ?? 1),
    filter: (search.filter as string) || '',
    sort:
      search.sort === 'newest' ||
      search.sort === 'oldest' ||
      search.sort === 'price'
        ? search.sort
        : 'newest',
  }),
  component: ProductsPage,
})

function ProductsPage() {
  const { page, filter, sort } = Route.useSearch()
  return <div>Page {page}</div>
}
```

### Manual Validation with Error Throwing

If `validateSearch` throws, the route's `errorComponent` renders instead:

```tsx
export const Route = createFileRoute('/products')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page)
    if (isNaN(page) || page < 1) {
      throw new Error('Invalid page number')
    }
    return { page }
  },
  errorComponent: ({ error }) => <div>Bad search params: {error.message}</div>,
})
```

---

## Pattern: Object with `parse` Method

Any object with a `.parse()` method works as `validateSearch`:

```tsx
const mySchema = {
  parse: (input: Record<string, unknown>) => ({
    page: Number(input.page ?? 1),
    query: String(input.query ?? ''),
  }),
}

export const Route = createFileRoute('/search')({
  validateSearch: mySchema,
})
```

---

## Dates in Search Params

Never put `Date` objects in search params. Always use ISO strings:

```tsx
const schema = z.object({
  // Store as string, parse in component if needed
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

// In component:
function DateFilter() {
  const { startDate } = Route.useSearch()
  const date = startDate ? new Date(startDate) : null
  return <div>{date?.toLocaleDateString()}</div>
}

// When navigating:
;<Link search={(prev) => ({ ...prev, startDate: new Date().toISOString() })}>
  Set Start Date
</Link>
```
