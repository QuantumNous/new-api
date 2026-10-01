---
title: Validate Search Parameters with Schemas
---

Learn how to add robust schema validation to your search parameters using popular validation libraries like Zod, Valibot, and ArkType. This guide covers validation setup, error handling, type safety, and common validation patterns for production applications.

**Prerequisites:** [Set Up Basic Search Parameters](./setup-basic-search-params.md) - Foundation concepts for reading and working with search params.

## Quick Start

Add robust validation with custom error messages, complex types, and production-ready error handling:

```tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

const productSearchSchema = z.object({
  query: z.string().min(1, 'Search query required'),
  category: z.enum(['electronics', 'clothing', 'books', 'home']).optional(),
  minPrice: z.number().min(0, 'Price cannot be negative').default(0),
  maxPrice: z.number().min(0, 'Price cannot be negative').default(1000),
  inStock: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    })
    .optional(),
})

export const Route = createFileRoute('/products')({
  validateSearch: productSearchSchema,
  errorComponent: ({ error }) => {
    const router = useRouter()
    return (
      <div className="error">
        <h2>Invalid Search Parameters</h2>
        <p>{error.message}</p>
        <button
          onClick={() => router.navigate({ to: '/products', search: {} })}
        >
          Reset Search
        </button>
      </div>
    )
  },
  component: ProductsPage,
})

function ProductsPage() {
  // All search params are validated, type-safe, and have fallback values applied
  const { query, category, minPrice, maxPrice, inStock, tags, dateRange } =
    Route.useSearch()

  return (
    <div>
      <h1>Products</h1>
      <p>Search: {query}</p>
      <p>Category: {category || 'All'}</p>
      <p>
        Price Range: ${minPrice} - ${maxPrice}
      </p>
      <p>In Stock Only: {inStock ? 'Yes' : 'No'}</p>
      {tags && <p>Tags: {tags.join(', ')}</p>}
      {dateRange && (
        <p>
          Date Range: {dateRange.start} to {dateRange.end}
        </p>
      )}
    </div>
  )
}
```

## Validation Library Options

TanStack Router supports multiple validation libraries through adapters:

### Zod (Recommended)

Most popular with excellent TypeScript integration. For Zod v3, use `@tanstack/zod-adapter` for validation:

```tsx
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1).max(100),
  page: fallback(z.number().int().positive(), 1),
  sortBy: z.enum(['name', 'date', 'relevance']).optional(),
  filters: z.array(z.string()).optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
})
```

For Zod v4, the adapter is no longer necessary:

```tsx
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1).max(100),
  page: z.number().int().positive().default(1),
  sortBy: z.enum(['name', 'date', 'relevance']).optional(),
  filters: z.array(z.string()).optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  component: SearchPage,
})
```

### Valibot

Lightweight alternative with modular design:

```tsx
import { valibotValidator } from '@tanstack/valibot-adapter'
import * as v from 'valibot'

const searchSchema = v.object({
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  page: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  sortBy: v.optional(v.picklist(['name', 'date', 'relevance'])),
  filters: v.optional(v.array(v.string())),
})

export const Route = createFileRoute('/search')({
  validateSearch: valibotValidator(searchSchema),
  component: SearchPage,
})
```

### ArkType

TypeScript-first with runtime validation:

```tsx
import { type } from 'arktype'

const searchSchema = type({
  query: 'string>0&<=100',
  page: 'number>0 = 1',
  'sortBy?': "'name'|'date'|'relevance'",
  'filters?': 'string[]',
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  component: SearchPage,
})
```

### Custom Validation Function

For complete control, implement your own validation logic:

```tsx
export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => {
    // Custom validation with detailed error handling
    const result = {
      page: 1,
      query: '',
      category: 'all',
    }

    // Validate page number
    const pageNum = Number(search.page)
    if (isNaN(pageNum) || pageNum < 1) {
      throw new Error('Page must be a positive number')
    }
    result.page = pageNum

    // Validate query string
    if (typeof search.query === 'string' && search.query.length > 0) {
      if (search.query.length > 100) {
        throw new Error('Search query too long (max 100 characters)')
      }
      result.query = search.query
    }

    // Validate category
    const validCategories = ['electronics', 'clothing', 'books', 'all']
    if (
      typeof search.category === 'string' &&
      validCategories.includes(search.category)
    ) {
      result.category = search.category
    }

    return result
  },
  component: SearchPage,
})
```

## Common Validation Patterns

### Required vs Optional Parameters

Control which search parameters are mandatory:

```tsx
const validationSchema = z.object({
  // Required - will throw validation error if missing or invalid
  userId: z.number().int().positive(),
  action: z.enum(['view', 'edit', 'delete']),

  // Optional - can be undefined
  sortBy: z.string().optional(),

  // Optional with fallback - provides default if missing/invalid
  page: fallback(z.number().int().positive(), 1),
  limit: fallback(z.number().int().min(1).max(100), 20),
})
```

### Complex Data Types

Handle arrays, objects, and custom types:

```tsx
const advancedSchema = z.object({
  // Array of strings
  tags: z.array(z.string()).optional(),

  // Array of numbers
  categoryIds: z.array(z.number().int()).optional(),

  // Date validation
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Custom validation
  email: z.string().email().optional(),

  // Refined validation with custom logic
  priceRange: z
    .object({
      min: z.number().min(0),
      max: z.number().min(0),
    })
    .refine((data) => data.max >= data.min, {
      message: 'Max price must be greater than or equal to min price',
    })
    .optional(),
})
```

### Input Transformation

Transform and sanitize input values during validation:

```tsx
const transformSchema = z.object({
  // Transform string to number
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Transform and validate email
  email: z.string().toLowerCase().trim().pipe(z.string().email()).optional(),

  // Transform comma-separated string to array
  tags: z
    .string()
    .transform((val) => (val ? val.split(',').map((tag) => tag.trim()) : []))
    .pipe(z.array(z.string().min(1)))
    .optional(),
})
```

## Error Handling Strategies

### Basic Error Handling

Handle validation errors through route error components:

```tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  page: z.number().int().positive('Page must be a positive number'),
})

export const Route = createFileRoute('/search')({
  validateSearch: zodValidator(searchSchema),
  errorComponent: ({ error }) => {
    const router = useRouter()

    return (
      <div className="error">
        <h2>Invalid Search Parameters</h2>
        <p>{error.message}</p>
        <button onClick={() => router.navigate({ to: '/search', search: {} })}>
          Reset Search
        </button>
        <button
          onClick={() =>
            router.navigate({ to: '/search', search: { query: '', page: 1 } })
          }
        >
          Start Over
        </button>
      </div>
    )
  },
  component: SearchPage,
})

function SearchPage() {
  // Only called when validation succeeds
  const search = Route.useSearch()
  // ... rest of component
}
```

### Custom Error Messages

Provide user-friendly validation messages:

```tsx
const userFriendlySchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query cannot exceed 100 characters'),

  page: fallback(
    z
      .number()
      .int('Page must be a whole number')
      .positive('Page must be greater than 0'),
    1,
  ),

  category: z
    .enum(['electronics', 'clothing', 'books'], {
      errorMap: () => ({ message: 'Please select a valid category' }),
    })
    .optional(),
})
```

### Validation Error Recovery

Implement fallback behavior for invalid parameters:

```tsx
const resilientSchema = z.object({
  // Use .catch() to provide fallback values on validation failure
  page: z.number().int().positive().catch(1),

  // Use .default() for missing values, .catch() for invalid values
  sortBy: z
    .enum(['name', 'date', 'relevance'])
    .default('relevance')
    .catch('relevance'),

  // Custom recovery logic
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .catch({
      start: new Date().toISOString(),
      end: new Date().toISOString(),
    })
    .optional(),
})
```

## Advanced Validation Techniques

### Conditional Validation

Apply different validation rules based on other parameters:

```tsx
const conditionalSchema = z
  .object({
    searchType: z.enum(['basic', 'advanced']),
    query: z.string().min(1),
  })
  .and(
    z.discriminatedUnion('searchType', [
      z.object({
        searchType: z.literal('basic'),
        // Basic search requires only query
      }),
      z.object({
        searchType: z.literal('advanced'),
        // Advanced search requires additional fields
        category: z.string().min(1),
        minPrice: z.number().min(0),
        maxPrice: z.number().min(0),
      }),
    ]),
  )
```

### Schema Composition

Combine and extend schemas for reusability:

```tsx
// Base pagination schema
const paginationSchema = z.object({
  page: fallback(z.number().int().positive(), 1),
  limit: fallback(z.number().int().min(1).max(100), 20),
})

// Base filter schema
const filterSchema = z.object({
  sortBy: z.enum(['name', 'date', 'relevance']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

// Compose schemas for different routes
const productSearchSchema = paginationSchema.extend({
  category: z.string().optional(),
  inStock: fallback(z.boolean(), true),
})

const userSearchSchema = paginationSchema.merge(filterSchema).extend({
  role: z.enum(['admin', 'user', 'moderator']).optional(),
  isActive: fallback(z.boolean(), true),
})
```

### Performance Optimization

Optimize validation for better performance:

```tsx
// Pre-compile schemas for better performance
const compiledSchema = zodValidator(
  z.object({
    query: z.string().min(1),
    page: fallback(z.number().int().positive(), 1),
  }),
)

export const Route = createFileRoute('/search')({
  validateSearch: compiledSchema,
  component: SearchPage,
})

// Use selective validation for expensive operations
function SearchPage() {
  // Only validate specific fields when needed
  const search = Route.useSearch({
    select: (search) => ({
      query: search.query,
      page: search.page,
    }),
  })

  return <div>Search Results</div>
}
```

## Testing Search Parameter Validation

Focus on testing validation behavior specific to your schemas:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import {
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'

describe('Search Validation Behavior', () => {
  it('should show error component when validation fails', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/search?page=invalid&query='],
      }),
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Invalid Search Parameters')).toBeInTheDocument()
    })
  })

  it('should apply fallback values correctly', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/search?query=laptops'], // page missing
      }),
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Page: 1')).toBeInTheDocument() // Fallback applied
    })
  })
})
```

**For comprehensive route testing patterns, see:** [Set Up Testing](./setup-testing.md) and [Test File-Based Routing](./test-file-based-routing.md)

## Common Problems

### Problem: Validation errors break the entire route

**Symptoms:** Page fails to load when URL contains invalid search parameters.

**Solution:** Use fallback values and error boundaries:

```tsx
// ❌ Wrong - will throw error and break route
const strictSchema = z.object({
  page: z.number().int().positive(), // No fallback
})

// ✅ Correct - provides fallback for invalid values
const resilientSchema = z.object({
  page: fallback(z.number().int().positive(), 1),
})

// ✅ Alternative - use errorComponent on route
export const Route = createFileRoute('/search')({
  validateSearch: resilientSchema,
  errorComponent: ({ error }) => <SearchError error={error} />,
  component: SearchPage,
})

function SearchPage() {
  // Only called when validation succeeds
  const search = Route.useSearch()
  return <SearchResults search={search} />
}
```

### Problem: TypeScript errors with optional search parameters

**Symptoms:** TypeScript complains about potentially undefined values.

**Solution:** Use proper optional handling or fallback values:

```tsx
// ❌ Wrong - category might be undefined
function FilterBar() {
  const { category } = Route.useSearch()
  return <span>{category.toUpperCase()}</span> // TypeScript error
}

// ✅ Correct - handle optional values
function FilterBar() {
  const { category } = Route.useSearch()
  return <span>{category?.toUpperCase() || 'All Categories'}</span>
}

// ✅ Better - use fallback in schema
const schema = z.object({
  category: fallback(z.string(), 'all'),
})
```

### Problem: Search parameter arrays not parsing correctly

**Symptoms:** Array values appear as strings instead of arrays.

**Solution:** Ensure proper array parsing in your schema:

```tsx
// ❌ Wrong - doesn't handle URL array format
const badSchema = z.object({
  tags: z.array(z.string()).optional(),
})

// ✅ Correct - parse comma-separated values or multiple params
const goodSchema = z.object({
  tags: z
    .union([
      z.array(z.string()), // Multiple ?tags=a&tags=b
      z.string().transform((val) => val.split(',')), // Single ?tags=a,b,c
    ])
    .optional(),
})

// ✅ Alternative - custom preprocessing
const preprocessedSchema = z.preprocess((val) => {
  if (typeof val === 'string') return val.split(',')
  return val
}, z.array(z.string()).optional())
```

### Problem: Schema validation is too slow

**Symptoms:** Noticeable delay when navigating with complex search parameters.

**Solution:** Optimize schema complexity and use selective parsing:

```tsx
// ❌ Slow - complex validation on every navigation
const complexSchema = z.object({
  query: z.string().refine(async (val) => await validateQuery(val)),
  // ... many complex validations
})

// ✅ Fast - simplified validation with lazy refinement
const optimizedSchema = z.object({
  query: z.string().min(1), // Basic validation only
  // ... other simple validations
})

// Perform complex validation separately in component
function SearchPage() {
  const search = Route.useSearch()

  // Complex validation only when needed
  const [complexValidation, setComplexValidation] = useState(null)

  useEffect(() => {
    validateComplexRules(search).then(setComplexValidation)
  }, [search])

  return <SearchResults search={search} validation={complexValidation} />
}
```

## Common Next Steps

After setting up schema validation, you might want to:

- [Work with Arrays, Objects, and Dates](./arrays-objects-dates-search-params.md) - Handle arrays, objects, dates, and nested data structures

<!-- Uncomment when guides are available
- [Share Search Parameters Across Routes](./share-search-params-across-routes.md) - Inherit and manage search params across route hierarchies
- [Debug Search Parameter Issues](./debug-search-param-issues.md) - Troubleshoot validation problems and performance issues
-->

## Related Resources

- [TanStack Zod Adapter Documentation](https://tanstack.com/router/latest/docs/framework/react/guide/search-params#zod-adapter)
- [TanStack Valibot Adapter Documentation](https://tanstack.com/router/latest/docs/framework/react/guide/search-params#valibot-adapter)
- [Zod Documentation](https://zod.dev/) - Schema validation library
- [Valibot Documentation](https://valibot.dev/) - Lightweight validation library
- [ArkType Documentation](https://arktype.io/) - TypeScript-first validation
