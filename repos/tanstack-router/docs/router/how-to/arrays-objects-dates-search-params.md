---
title: Work with Arrays, Objects, and Dates in Search Parameters
---

Learn to handle arrays, objects, dates, and nested data structures in search parameters while maintaining type safety and URL compatibility.

## Quick Start

Complex search parameters go beyond simple strings and numbers. TanStack Router's JSON-first approach makes it easy to handle arrays, objects, dates, and nested structures:

```tsx
// Example of complex search parameters
const complexSearch = {
  tags: ['typescript', 'react', 'router'], // Array
  filters: {
    // Nested object
    category: 'web',
    minRating: 4.5,
    active: true,
  },
  dateRange: {
    // Date objects
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31'),
  },
  pagination: {
    // Nested pagination
    page: 1,
    size: 20,
    sort: { field: 'name', direction: 'asc' },
  },
}
```

## Working with Arrays

Arrays are commonly used for filters, tags, categories, and multi-select options.

### Basic Array Validation

```tsx
// routes/products.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).optional(),
  priceRange: z.array(z.number()).length(2).optional(), // [min, max]
})

export const Route = createFileRoute('/products')({
  validateSearch: searchSchema,
  component: ProductsComponent,
})

function ProductsComponent() {
  const { categories, tags, priceRange } = Route.useSearch()

  return (
    <div>
      <h2>Active Categories: {categories.join(', ')}</h2>
      {tags && <p>Tags: {tags.join(', ')}</p>}
      {priceRange && (
        <p>
          Price: ${priceRange[0]} - ${priceRange[1]}
        </p>
      )}
    </div>
  )
}
```

### Navigating with Arrays

```tsx
import { Link } from '@tanstack/react-router'

function FilterControls() {
  return (
    <div>
      {/* Add to existing array */}
      <Link
        to="/products"
        search={(prev) => ({
          ...prev,
          categories: [...(prev.categories || []), 'electronics'],
        })}
      >
        Add Electronics
      </Link>

      {/* Replace entire array */}
      <Link to="/products" search={{ categories: ['books', 'music'] }}>
        Books & Music Only
      </Link>

      {/* Remove from array */}
      <Link
        to="/products"
        search={(prev) => ({
          ...prev,
          categories:
            prev.categories?.filter((cat) => cat !== 'electronics') || [],
        })}
      >
        Remove Electronics
      </Link>

      {/* Clear array */}
      <Link to="/products" search={(prev) => ({ ...prev, categories: [] })}>
        Clear All
      </Link>
    </div>
  )
}
```

### Advanced Array Patterns

```tsx
// routes/search.tsx
const advancedArraySchema = z.object({
  // Array of objects
  filters: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['eq', 'gt', 'lt', 'contains']),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .default([]),

  // Array with constraints
  selectedIds: z.array(z.string().uuid()).max(10).default([]),

  // Array with transformation
  sortFields: z
    .array(z.string())
    .transform((arr) =>
      arr.filter((field) => ['name', 'date', 'price'].includes(field)),
    )
    .default(['name']),
})

export const Route = createFileRoute('/search')({
  validateSearch: advancedArraySchema,
  component: SearchComponent,
})
```

## Working with Objects

Objects are useful for grouped parameters, complex filters, and nested configurations.

### Basic Object Validation

```tsx
// routes/dashboard.tsx
const dashboardSchema = z.object({
  view: z
    .object({
      layout: z.enum(['grid', 'list', 'cards']).default('grid'),
      columns: z.number().min(1).max(6).default(3),
      showDetails: z.boolean().default(false),
    })
    .prefault({}),

  filters: z
    .object({
      status: z.enum(['active', 'inactive', 'pending']).optional(),
      dateCreated: z
        .object({
          after: z.string().optional(),
          before: z.string().optional(),
        })
        .optional(),
      metadata: z.record(z.string(), z.string()).optional(), // Dynamic object keys
    })
    .prefault({}),
})

export const Route = createFileRoute('/dashboard')({
  validateSearch: dashboardSchema,
  component: DashboardComponent,
})

function DashboardComponent() {
  const { view, filters } = Route.useSearch()

  return (
    <div>
      <div className={`layout-${view.layout} columns-${view.columns}`}>
        {/* Render based on complex object state */}
      </div>

      {filters.status && <p>Status: {filters.status}</p>}
      {filters.dateCreated?.after && (
        <p>Created after: {filters.dateCreated.after}</p>
      )}
    </div>
  )
}
```

### Navigating with Objects

```tsx
function ViewControls() {
  return (
    <div>
      {/* Update nested object property */}
      <Link
        to="/dashboard"
        search={(prev) => ({
          ...prev,
          view: {
            ...prev.view,
            layout: 'list',
          },
        })}
      >
        List View
      </Link>

      {/* Update multiple nested properties */}
      <Link
        to="/dashboard"
        search={(prev) => ({
          ...prev,
          view: {
            ...prev.view,
            layout: 'grid',
            columns: 4,
            showDetails: true,
          },
        })}
      >
        4-Column Grid with Details
      </Link>

      {/* Deep merge with library for complex updates */}
      <Link
        to="/dashboard"
        search={(prev) =>
          merge(prev, {
            filters: {
              dateCreated: { after: '2024-01-01' },
            },
          })
        }
      >
        Filter Recent Items
      </Link>
    </div>
  )
}

// For deep merging, use a well-tested library:

// Option 1: Lodash (most popular, full-featured)
// npm install lodash-es
// import { merge } from 'lodash-es'

// Option 2: deepmerge (lightweight, focused)
// npm install deepmerge
// import merge from 'deepmerge'

// Option 3: Ramda (functional programming style)
// npm install ramda
// import { mergeDeepRight as merge } from 'ramda'

// Example with deepmerge (recommended for most cases):
import merge from 'deepmerge'

// Handles arrays intelligently - combines by default
const result = merge(
  { filters: { tags: ['react'] } },
  { filters: { tags: ['typescript'] } },
)
// Result: { filters: { tags: ['react', 'typescript'] } }

// Override array merging behavior if needed
const overwriteResult = merge(
  { filters: { tags: ['react'] } },
  { filters: { tags: ['typescript'] } },
  { arrayMerge: (dest, source) => source }, // Overwrite instead of combine
)
// Result: { filters: { tags: ['typescript'] } }
```

## Working with Dates

Dates require special handling for URL serialization and validation.

### Date Validation and Serialization

```tsx
// routes/events.tsx
const eventSchema = z.object({
  // ISO string dates
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Date range as object
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),

  // Transform string to Date object
  selectedDate: z
    .string()
    .datetime()
    .transform((str) => new Date(str))
    .optional(),

  // Relative dates
  timeFilter: z.enum(['today', 'week', 'month', 'year']).default('week'),
})

export const Route = createFileRoute('/events')({
  validateSearch: eventSchema,
  component: EventsComponent,
})

function EventsComponent() {
  const search = Route.useSearch()

  // Convert string dates back to Date objects for display
  const startDate = search.startDate ? new Date(search.startDate) : null
  const endDate = search.endDate ? new Date(search.endDate) : null

  return (
    <div>
      {startDate && <p>Events from: {startDate.toLocaleDateString()}</p>}
      {search.selectedDate && (
        <p>Selected: {search.selectedDate.toLocaleDateString()}</p>
      )}
    </div>
  )
}
```

### Date Navigation Patterns

```tsx
function DateControls() {
  const navigate = useNavigate()

  const setDateRange = (start: Date, end: Date) => {
    navigate({
      to: '/events',
      search: (prev) => ({
        ...prev,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      }),
    })
  }

  const setRelativeDate = (period: string) => {
    const now = new Date()
    let start: Date

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      default:
        start = now
    }

    setDateRange(start, now)
  }

  return (
    <div>
      <button onClick={() => setRelativeDate('today')}>Today</button>
      <button onClick={() => setRelativeDate('week')}>Past Week</button>
      <button onClick={() => setRelativeDate('month')}>Past Month</button>

      {/* Date picker integration */}
      <input
        type="date"
        onChange={(e) => {
          const date = new Date(e.target.value)
          navigate({
            to: '/events',
            search: (prev) => ({
              ...prev,
              selectedDate: date.toISOString(),
            }),
          })
        }}
      />
    </div>
  )
}
```

## Nested Data Structures

Complex applications often need deeply nested search parameters.

### Complex Nested Schema

```tsx
// routes/analytics.tsx
const analyticsSchema = z.object({
  dashboard: z
    .object({
      widgets: z
        .array(
          z.object({
            id: z.string(),
            type: z.enum(['chart', 'table', 'metric']),
            config: z.object({
              title: z.string(),
              dataSource: z.string(),
              filters: z.array(
                z.object({
                  field: z.string(),
                  operator: z.string(),
                  value: z.any(),
                }),
              ),
              visualization: z
                .object({
                  chartType: z.enum(['line', 'bar', 'pie']).optional(),
                  colors: z.array(z.string()).optional(),
                  axes: z
                    .object({
                      x: z.string(),
                      y: z.array(z.string()),
                    })
                    .optional(),
                })
                .optional(),
            }),
          }),
        )
        .default([]),

      layout: z
        .object({
          columns: z.number().min(1).max(12).default(2),
          gap: z.number().default(16),
          responsive: z.boolean().default(true),
        })
        .prefault({}),

      timeRange: z
        .object({
          preset: z.enum(['1h', '24h', '7d', '30d', 'custom']).default('24h'),
          custom: z
            .object({
              start: z.string().datetime(),
              end: z.string().datetime(),
            })
            .optional(),
        })
        .prefault({}),
    })
    .prefault({}),
})

export const Route = createFileRoute('/analytics')({
  validateSearch: analyticsSchema,
  component: AnalyticsComponent,
})
```

### Managing Complex State Updates

```tsx
function AnalyticsControls() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  // Helper to update nested widget config
  const updateWidgetConfig = (widgetId: string, configUpdate: any) => {
    navigate({
      to: '/analytics',
      search: (prev) => ({
        ...prev,
        dashboard: {
          ...prev.dashboard,
          widgets: prev.dashboard.widgets.map((widget) =>
            widget.id === widgetId
              ? {
                  ...widget,
                  config: { ...widget.config, ...configUpdate },
                }
              : widget,
          ),
        },
      }),
    })
  }

  // Helper to add new widget
  const addWidget = (widget: any) => {
    navigate({
      to: '/analytics',
      search: (prev) => ({
        ...prev,
        dashboard: {
          ...prev.dashboard,
          widgets: [...prev.dashboard.widgets, widget],
        },
      }),
    })
  }

  // Helper to update layout
  const updateLayout = (layoutUpdate: any) => {
    navigate({
      to: '/analytics',
      search: (prev) => ({
        ...prev,
        dashboard: {
          ...prev.dashboard,
          layout: { ...prev.dashboard.layout, ...layoutUpdate },
        },
      }),
    })
  }

  return (
    <div>
      <button onClick={() => updateLayout({ columns: 3 })}>3 Columns</button>

      <button
        onClick={() =>
          addWidget({
            id: Date.now().toString(),
            type: 'chart',
            config: {
              title: 'New Chart',
              dataSource: 'default',
              filters: [],
            },
          })
        }
      >
        Add Chart Widget
      </button>
    </div>
  )
}
```

## Performance Optimization

### Selective Updates with Selectors

```tsx
// Only re-render when specific nested values change
function WidgetComponent({ widgetId }: { widgetId: string }) {
  // Use selector to avoid unnecessary re-renders
  const widget = Route.useSearch({
    select: (search) => search.dashboard.widgets.find((w) => w.id === widgetId),
  })

  const layout = Route.useSearch({
    select: (search) => search.dashboard.layout,
  })

  if (!widget) return null

  return (
    <div
      style={{
        gridColumn: `span ${Math.ceil(12 / layout.columns)}`,
      }}
    >
      <h3>{widget.config.title}</h3>
      {/* Widget content */}
    </div>
  )
}
```

### Memoization for Complex Transforms

```tsx
import { useMemo } from 'react'

function ComplexDataComponent() {
  const search = Route.useSearch()

  // Memoize expensive transformations
  const processedData = useMemo(() => {
    return search.dashboard.widgets
      .filter((widget) => widget.type === 'chart')
      .map((widget) => ({
        ...widget,
        computedMetrics: expensiveCalculation(widget.config),
      }))
  }, [search.dashboard.widgets])

  return (
    <div>
      {processedData.map((widget) => (
        <ComplexChart key={widget.id} data={widget} />
      ))}
    </div>
  )
}
```

## Production Checklist

- [ ] **Array bounds validation** - Use `.min()`, `.max()`, `.length()` constraints
- [ ] **Date format consistency** - Stick to ISO strings for URL compatibility
- [ ] **Object depth limits** - Avoid excessively nested structures for URL length
- [ ] **Performance testing** - Test with large arrays/objects in search params
- [ ] **URL length limits** - Most browsers limit URLs to ~2000 characters
- [ ] **Fallback values** - Provide sensible defaults for all complex types
- [ ] **Type safety** - Ensure schemas match your component expectations
- [ ] **Serialization testing** - Verify round-trip serialization works correctly

## Common Problems

### Problem: Array Parameters Not Updating

**Symptoms:** Link clicks don't update array search parameters.

**Cause:** Directly mutating arrays instead of creating new ones.

**Solution:** Always create new arrays when updating:

```tsx
// ❌ Wrong - mutates existing array
search={(prev) => {
  prev.categories.push('new-item')
  return prev
}}

// ✅ Correct - creates new array
search={(prev) => ({
  ...prev,
  categories: [...prev.categories, 'new-item']
})}
```

### Problem: Dates Not Serializing Correctly

**Symptoms:** Date objects become `[object Object]` in URL.

**Cause:** Attempting to serialize Date objects directly.

**Solution:** Convert dates to ISO strings:

```tsx
// ❌ Wrong - Date objects don't serialize
search={{
  startDate: new Date() // Becomes "[object Object]"
}}

// ✅ Correct - Use ISO strings
search={{
  startDate: new Date().toISOString()
}}
```

### Problem: Deep Object Updates Not Working

**Symptoms:** Nested object properties don't update as expected.

**Cause:** Shallow merging doesn't update nested properties.

**Solution:** Use proper deep merging or spread operators:

```tsx
// ❌ Wrong - shallow merge loses nested properties
search={(prev) => ({
  ...prev,
  filters: { category: 'new' } // Loses other filter properties
})}

// ✅ Correct - preserve nested properties
search={(prev) => ({
  ...prev,
  filters: {
    ...prev.filters,
    category: 'new'
  }
})}
```

### Problem: URL Too Long Error

**Symptoms:** Browser errors with very complex search parameters.

**Cause:** Exceeding browser URL length limits (~2000 characters).

**Solutions:**

1. **Simplify data structures** - Remove unnecessary nesting
2. **Use compression** - Implement custom serialization
3. **Store in session** - Keep complex state in sessionStorage with URL key
4. **Pagination** - Break large arrays into pages

```tsx
// Option 3: Session storage approach
const sessionKey = Route.useSearch({ select: (s) => s.sessionKey })
const complexData = useMemo(() => {
  if (sessionKey) {
    return JSON.parse(sessionStorage.getItem(sessionKey) || '{}')
  }
  return {}
}, [sessionKey])
```

### Problem: Performance Issues with Large Objects

**Symptoms:** Slow navigation and re-renders with complex search parameters.

**Cause:** Large objects causing expensive serialization and comparison operations.

**Solutions:**

1. **Use selectors** to limit re-renders
2. **Memoize expensive calculations**
3. **Consider alternatives** like context or state management

```tsx
// Use selector to minimize re-renders
const onlyNeededData = Route.useSearch({
  select: (search) => ({
    currentPage: search.pagination.page,
    pageSize: search.pagination.size,
  }),
})
```

## Common Next Steps

<!-- - [Share Search Parameters Across Routes](./share-search-params-across-routes.md) - Inherit and manage search params across route hierarchies -->
<!-- - [Optimize Search Parameter Performance](./optimize-search-param-performance.md) - Advanced performance patterns for search state -->
<!-- - [Customize Search Parameter Serialization](./customize-search-param-serialization.md) - Implement custom serialization for compression and compatibility -->
<!-- - [Build Search-Based Filtering Systems](./build-search-filtering-systems.md) - Create filtering UIs with URL state -->

## Related Resources

- [Search Params Guide](../guide/search-params.md) - Core concepts and JSON-first approach
- [Zod Documentation](https://zod.dev/) - Schema validation library
- [MDN Date.toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString) - Date serialization reference
- [URLSearchParams Limits](https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers) - Browser URL length limits

**Deep Merging Libraries:**

- [deepmerge](https://www.npmjs.com/package/deepmerge) - Lightweight, focused deep merging utility
- [Lodash merge](https://lodash.com/docs#merge) - Full-featured utility library with deep merging
- [Ramda mergeDeepRight](https://ramdajs.com/docs/#mergeDeepRight) - Functional programming approach
