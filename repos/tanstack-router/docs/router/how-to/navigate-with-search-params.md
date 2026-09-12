---
title: How to Navigate with Search Parameters
---

This guide covers updating and managing search parameters during navigation using TanStack Router's Link components and programmatic navigation methods.

**Prerequisites:** [Set Up Basic Search Parameters](./setup-basic-search-params.md) - Foundation concepts for reading and validating search params.

## Quick Start

Configure navigation that updates search parameters while preserving existing state:

```tsx
import { Link, useNavigate } from '@tanstack/react-router'

// Link with search parameter updates
;<Link to="/search" search={(prev) => ({ ...prev, query: 'new search' })}>
  Search for "new search"
</Link>

// Programmatic navigation
const navigate = useNavigate()
navigate({
  to: '/search',
  search: (prev) => ({ ...prev, page: 1 }),
})
```

## Navigation Methods

### Using Link Components

#### Basic Search Parameter Updates

Replace all search parameters:

```tsx
import { Link } from '@tanstack/router'

function SearchForm() {
  return (
    <div>
      {/* Replace all search params */}
      <Link to="/products" search={{ category: 'electronics', page: 1 }}>
        Electronics
      </Link>

      {/* Navigate to same route with new search */}
      <Link search={{ sort: 'price-asc' }}>Sort by Price</Link>
    </div>
  )
}
```

#### Functional Search Parameter Updates

Merge with existing search parameters:

```tsx
import { Link } from '@tanstack/react-router'

function Pagination() {
  return (
    <div>
      {/* Preserve existing search, update page */}
      <Link search={(prev) => ({ ...prev, page: (prev.page || 1) + 1 })}>
        Next Page
      </Link>

      {/* Toggle filter while keeping other params */}
      <Link
        search={(prev) => ({
          ...prev,
          inStock: !prev.inStock,
        })}
      >
        Toggle In Stock
      </Link>

      {/* Remove a search parameter */}
      <Link
        search={(prev) => {
          const { category, ...rest } = prev
          return rest
        }}
      >
        Clear Category Filter
      </Link>
    </div>
  )
}
```

#### Preserving All Search Parameters

Use `search={true}` to keep all current search parameters when navigating:

```tsx
import { Link } from '@tanstack/react-router'

function Navigation() {
  return (
    <nav>
      {/* Keep all search params when changing routes */}
      <Link to="/products" search={true}>
        View Products (Keep Filters)
      </Link>

      {/* Equivalent functional approach */}
      <Link to="/products" search={(prev) => prev}>
        View Products (Functional)
      </Link>
    </nav>
  )
}
```

#### Navigation with Route Changes

Navigate to different routes with search parameters:

```tsx
import { Link } from '@tanstack/react-router'

function Navigation() {
  return (
    <nav>
      {/* Navigate to different route with search */}
      <Link to="/search" search={{ query: 'laptops', category: 'electronics' }}>
        Search Laptops
      </Link>

      {/* Inherit current search params to new route */}
      <Link
        to="/products"
        search={true} // Shorthand to carry over all search params
      >
        View Products
      </Link>

      {/* Transform search params for new route */}
      <Link
        to="/advanced-search"
        search={(prev) => ({
          q: prev.query, // Rename parameter
          filters: {
            category: prev.category,
            inStock: prev.inStock,
          },
        })}
      >
        Advanced Search
      </Link>
    </nav>
  )
}
```

### Programmatic Navigation

#### Using useNavigate Hook

Navigate programmatically with search parameter updates:

```tsx
import { useNavigate } from '@tanstack/react-router'

function SearchControls() {
  const navigate = useNavigate()

  const handleSortChange = (sortBy: string) => {
    navigate({
      search: (prev) => ({ ...prev, sort: sortBy, page: 1 }),
    })
  }

  const handleClearFilters = () => {
    navigate({
      search: (prev) => {
        const { category, minPrice, maxPrice, ...rest } = prev
        return rest
      },
    })
  }

  const handleSearch = (query: string) => {
    navigate({
      to: '/search',
      search: { query, page: 1 },
    })
  }

  return (
    <div>
      <select onChange={(e) => handleSortChange(e.target.value)}>
        <option value="relevance">Sort by Relevance</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>

      <button onClick={handleClearFilters}>Clear Filters</button>

      <button onClick={() => handleSearch('latest products')}>
        Search Latest
      </button>
    </div>
  )
}
```

#### Navigation with Router Instance

Use the router directly only in non-React contexts where `useNavigate` or `Link` aren't available:

```tsx
import { router } from './router' // Your router instance

// ✅ Appropriate use case: Utility function outside React components
export function navigateFromUtility(searchParams: Record<string, any>) {
  router.navigate({
    search: (prev) => ({ ...prev, ...searchParams }),
  })
}

// ✅ Appropriate use case: Event handlers in non-React code
class ApiService {
  onAuthError() {
    // Navigate to login when auth fails
    router.navigate({
      to: '/login',
      search: { redirect: window.location.pathname },
    })
  }
}

// ✅ Appropriate use case: Global error handler
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason.status === 401) {
    router.navigate({
      to: '/login',
      search: { error: 'session-expired' },
    })
  }
})
```

**⚠️ In React components, prefer `useNavigate` instead:**

```tsx
// ❌ Avoid in React components
function Component() {
  const router = useRouter()

  const handleClick = () => {
    router.navigate({ search: { filter: 'active' } })
  }

  return <button onClick={handleClick}>Filter</button>
}

// ✅ Use useNavigate in React components
function Component() {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate({ search: { filter: 'active' } })
  }

  return <button onClick={handleClick}>Filter</button>
}
```

## Advanced Navigation Patterns

### Conditional Navigation

Navigate automatically when certain conditions are met:

```tsx
import { useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

function ConditionalNavigation() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/products' })

  // Auto-reset page when search query changes
  useEffect(() => {
    if (search.query && search.page > 1) {
      navigate({
        search: (prev) => ({ ...prev, page: 1 }),
      })
    }
  }, [search.query, search.page, navigate])

  return <div>Page resets automatically when search changes</div>
}
```

## Common Patterns

## Common Problems

### Search Parameters Not Updating

**Problem:** Link navigation doesn't update search parameters.

```tsx
// ❌ Wrong - no search prop
<Link to="/products">Electronics</Link>

// ✅ Correct - with search parameters
<Link to="/products" search={{ category: 'electronics' }}>
  Electronics
</Link>
```

### Losing Existing Search Parameters

**Problem:** New navigation replaces all search parameters instead of updating specific ones.

```tsx
// ❌ Wrong - replaces all search params
<Link search={{ page: 2 }}>Next Page</Link>

// ✅ Correct - preserves existing search params
<Link search={(prev) => ({ ...prev, page: 2 })}>
  Next Page
</Link>
```

## Common Next Steps

After mastering navigation with search parameters, you might want to:

- [Validate Search Parameters with Schemas](./validate-search-params.md) - Add robust validation with Zod, Valibot, or ArkType
- [Work with Arrays, Objects, and Dates](./arrays-objects-dates-search-params.md) - Handle arrays, objects, dates, and nested data structures

<!-- Uncomment when guides are available
- [Share Search Parameters Across Routes](./share-search-params-across-routes.md) - Inherit and manage search params across route hierarchies
-->

## Related Resources

- [TanStack Router Search Params Guide](https://tanstack.com/router/latest/docs/framework/react/guide/search-params) - Official documentation
