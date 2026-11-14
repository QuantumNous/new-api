---
title: How to Set Up Basic Search Parameters
---

Learn how to add type-safe, production-ready search parameters to your TanStack Router routes using schema validation. This guide covers the fundamentals of search parameter validation, reading values, and handling different data types with any standard schema-compliant validation library.

## Quick Start

Set up search parameters with schema validation (recommended for production):

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const productSearchSchema = z.object({
  page: z.number().default(1).catch(1),
  category: z.string().default('all').catch('all'),
  showSale: z.boolean().default(false).catch(false),
})

export const Route = createFileRoute('/products')({
  validateSearch: productSearchSchema,
  component: ProductsPage,
})

function ProductsPage() {
  const { page, category, showSale } = Route.useSearch()

  return (
    <div>
      <h1>Products</h1>
      <p>Page: {page}</p>
      <p>Category: {category}</p>
      <p>Show Sale Items: {showSale ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

## Why Use Schema Validation for Search Parameters?

**Production Benefits:**

- **Type Safety**: Automatic TypeScript inference
- **Runtime Validation**: Catches invalid URL parameters gracefully
- **Default Values**: Fallback handling for missing parameters
- **Error Handling**: Built-in validation error management
- **Maintainability**: Clear, declarative schema definitions

## Validation Library Setup

TanStack Router supports any standard schema-compliant validation library. This guide focuses on Zod for examples, but you can use any validation library.

Using Zod v4:

```tsx
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().default(1),
  category: z.string().default('all').catch('all'),
})

export const Route = createFileRoute('/products')({
  validateSearch: searchSchema,
  component: ProductsPage,
})
```

For Zod v3:

```bash
npm install zod @tanstack/zod-adapter
```

```tsx
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  page: fallback(z.number(), 1).default(1),
  category: fallback(z.string(), 'all').default('all'),
})

export const Route = createFileRoute('/products')({
  validateSearch: zodValidator(searchSchema),
  component: ProductsPage,
})
```

**For detailed validation library comparisons and advanced validation patterns, see:** [Validate Search Parameters with Schemas](./validate-search-params.md)

## Step-by-Step Setup with Zod

The rest of this guide uses Zod v4 for examples, but the patterns apply to any validation library.

### Step 1: Define Your Search Schema

Start by identifying what search parameters your route needs:

```tsx
import { z } from 'zod'

const shopSearchSchema = z.object({
  // Pagination
  page: z.number().default(1),
  limit: z.number().default(20),

  // Filtering
  category: z.string().default('all'),
  minPrice: z.number().default(0),
  maxPrice: z.number().default(1000),

  // Settings
  sort: z.enum(['name', 'price', 'date']).default('name'),
  ascending: z.boolean().default(true),

  // Optional parameters
  searchTerm: z.string().optional(),
  showOnlyInStock: z.boolean().default(false),
})

type ShopSearch = z.infer<typeof shopSearchSchema>
```

### Step 2: Add Schema Validation to Route

Connect your schema to the route:

```tsx
export const Route = createFileRoute('/shop')({
  validateSearch: shopSearchSchema,
  component: ShopPage,
})
```

### Step 3: Read Search Parameters in Components

Use the route's `useSearch()` hook to access validated and typed search parameters:

```tsx
function ShopPage() {
  const searchParams = Route.useSearch()

  // All properties are fully type-safe and validated
  const {
    page,
    limit,
    category,
    sort,
    ascending,
    searchTerm,
    showOnlyInStock,
  } = searchParams

  return (
    <div>
      <h1>Shop - Page {page}</h1>
      <div>Category: {category}</div>
      <div>
        Sort: {sort} ({ascending ? 'ascending' : 'descending'})
      </div>
      <div>Items per page: {limit}</div>
      <div>In stock only: {showOnlyInStock ? 'Yes' : 'No'}</div>
      {searchTerm && <div>Search: "{searchTerm}"</div>}
    </div>
  )
}
```

## Common Search Parameter Patterns

### Pagination with Constraints

```tsx
const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(10).max(100).default(20),
})

export const Route = createFileRoute('/posts')({
  validateSearch: paginationSchema,
  component: PostsPage,
})

function PostsPage() {
  const { page, limit } = Route.useSearch()

  // Calculate offset for API calls
  const offset = (page - 1) * limit

  return (
    <div>
      <h1>Posts (Page {page})</h1>
      <p>Showing {limit} posts per page</p>
      <p>Offset: {offset}</p>
      {/* Render posts... */}
    </div>
  )
}
```

### Enum Validation with Defaults

```tsx
const catalogSchema = z.object({
  sort: z.enum(['name', 'date', 'price']).default('name'),
  category: z.enum(['electronics', 'clothing', 'books', 'all']).default('all'),
  ascending: z.boolean().default(true),
})

export const Route = createFileRoute('/catalog')({
  validateSearch: catalogSchema,
  component: CatalogPage,
})
```

### Complex Data Types

```tsx
const dashboardSchema = z.object({
  // Numbers with validation
  userId: z.number().positive().default(1),
  refreshInterval: z.number().min(1000).max(60000).default(5000),

  // Strings with validation
  theme: z.enum(['light', 'dark']).default('light'),
  timezone: z.string().optional(),

  // Arrays with validation
  selectedIds: z.number().array().default([]),
  tags: z.string().array().default([]),

  // Objects with validation
  filters: z
    .object({
      status: z.enum(['active', 'inactive']).optional(),
      type: z.string().optional(),
    })
    .prefault({}),
})
```

### Date and Advanced Types

```tsx
const reportSchema = z.object({
  startDate: z.string().pipe(z.coerce.date()).optional(),
  endDate: z.string().pipe(z.coerce.date()).optional(),
  format: z.enum(['pdf', 'csv', 'excel']).default('pdf').catch('pdf'),
  includeCharts: z.boolean().default(true),
})
```

## Reading Search Parameters Outside Components

### Using getRouteApi

For code-split components or separate files:

```tsx
// components/ProductFilters.tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/products')

export function ProductFilters() {
  const { category, sort, showSale } = routeApi.useSearch()

  return (
    <div>
      <select value={category}>
        <option value="all">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
      </select>
      {/* More filters... */}
    </div>
  )
}
```

### Using useSearch with from

```tsx
import { useSearch } from '@tanstack/react-router'

function GenericSearchDisplay() {
  const search = useSearch({ from: '/products' })

  return <div>Current filters: {JSON.stringify(search, null, 2)}</div>
}
```

## Manual Validation (Understanding the Primitives)

While schema validation is recommended for production, understanding manual validation helps you understand how search parameters work under the hood:

```tsx
// Educational example - use schema validation for production
export const Route = createFileRoute('/example')({
  validateSearch: (search: Record<string, unknown>) => ({
    // Numbers need coercion from URL strings
    page: Number(search.page) || 1,

    // Strings can be cast with defaults
    category: (search.category as string) || 'all',

    // Booleans: TanStack Router auto-converts "true"/"false" to booleans
    showSale: Boolean(search.showSale),

    // Arrays need JSON parsing validation
    selectedIds: Array.isArray(search.selectedIds)
      ? search.selectedIds.map(Number).filter(Boolean)
      : [],
  }),
  component: ExamplePage,
})
```

## Production Checklist

- [x] **Use schema validation** with a validation library for type safety and runtime validation
- [x] **Add fallback values** for graceful error handling
- [x] **Set default values** for optional parameters
- [x] **Validate constraints** using your validation library's built-in validators
- [x] **Handle optional parameters** appropriately
- [x] **Type inference** works automatically with proper schema setup
- [x] **Error boundaries** are configured to handle validation failures

## Common Problems

### Problem: Search Parameters Cause TypeScript Errors

**Cause:** Missing or incorrect schema definition.

**Solution:** Ensure your schema covers all search parameters and use proper types:

```tsx
// ❌ Missing schema or incorrect types
export const Route = createFileRoute('/page')({
  component: MyPage,
})

// ✅ Complete schema with proper validation
const searchSchema = z.object({
  page: z.number().default(1).catch(1),
  category: z.string().default('all').catch('all'),
})

export const Route = createFileRoute('/page')({
  validateSearch: searchSchema,
  component: MyPage,
})
```

### Problem: Invalid URL Parameters Break the App

**Cause:** Not using fallback handling for error cases.

**Solution:** Use fallback values to provide safe defaults:

```tsx
// ❌ No fallback handling
const schema = z.object({
  page: z.number().default(1), // Will throw on invalid input
})

// ✅ Graceful fallback handling
const schema = z.object({
  page: z.number().default(1).catch(1), // Safe fallback to 1
})
```

### Problem: Optional Parameters Are Required by TypeScript

**Cause:** Using `.default()` makes parameters required in navigation.

**Solution:** Use `.optional()` for truly optional parameters:

```tsx
const schema = z.object({
  // Required with default (navigation can omit, but always present in component)
  page: z.number().default(1).catch(1),

  // Truly optional (can be undefined in component)
  searchTerm: z.string().optional(),
})
```

### Problem: Complex Objects Not Validating

**Cause:** Nested objects need explicit schema definition.

**Solution:** Define complete nested schemas:

```tsx
const schema = z.object({
  filters: z
    .object({
      status: z.enum(['active', 'inactive']).optional(),
      tags: z.string().array().optional(),
      dateRange: z
        .object({
          start: z.string().pipe(z.coerce.date()),
          end: z.string().pipe(z.coerce.date()),
        })
        .optional(),
    })
    .prefault({})
    .catch({}),
})
```

## Common Next Steps

After setting up basic search parameters, you might want to:

- [Validate Search Parameters with Schemas](./validate-search-params.md) - Add robust validation with Zod, Valibot, or ArkType
- [Navigate with Search Parameters](./navigate-with-search-params.md) - Learn to update search params with Links and navigation
- [Work with Arrays, Objects, and Dates](./arrays-objects-dates-search-params.md) - Handle arrays, objects, dates, and nested data structures

## Related Resources

- **Validation Libraries:**
  - [Zod Documentation](https://zod.dev/) - Complete validation library reference
  - [Valibot Documentation](https://valibot.dev/) - Lightweight validation library
  - [Yup Documentation](https://github.com/jquense/yup) - Object schema validation
- **TanStack Router:**
  - [TanStack Zod Adapter](https://tanstack.com/router/latest/docs/framework/react/api/router/zodValidator) - Official Zod adapter
  - [TanStack Valibot Adapter](https://tanstack.com/router/latest/docs/framework/react/api/router/valibotValidator) - Official Valibot adapter
  - [Search Parameters Guide](../guide/search-params.md) - Comprehensive search parameters documentation
  - [Type Safety Guide](../guide/type-safety.md) - Understanding TanStack Router's type safety
