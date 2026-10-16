# DRAFT: Build Search-Based Filtering Systems

**Final Destination:** `docs/router/framework/react/how-to/build-search-filtering-systems.md`  
**Progressive Series Position:** Specialized Use Cases - Guide #9  
**Depends On:** `setup-basic-search-params.md`, `navigate-with-search-params.md`, `validate-search-params.md`  
**Status:** Ready for implementation - comprehensive UI patterns available

---

## Content Staged from navigate-with-search-params.md

### Search Result Navigation

Handle search result navigation with query preservation:

```tsx
import { Link, useSearch } from '@tanstack/react-router'

function SearchResults() {
  const search = useSearch({ from: '/search' })

  return (
    <div>
      {/* Preserve search query, change view */}
      <nav>
        <Link search={(prev) => ({ ...prev, view: 'grid' })}>Grid View</Link>
        <Link search={(prev) => ({ ...prev, view: 'list' })}>List View</Link>
      </nav>

      {/* Pagination with query preservation */}
      <div>
        {search.page > 1 && (
          <Link search={(prev) => ({ ...prev, page: prev.page - 1 })}>
            Previous
          </Link>
        )}

        <Link search={(prev) => ({ ...prev, page: (prev.page || 1) + 1 })}>
          Next
        </Link>
      </div>

      {/* Related searches */}
      <div>
        Related searches:
        {['laptops gaming', 'laptops business', 'laptops student'].map(
          (suggestion) => (
            <Link
              key={suggestion}
              search={(prev) => ({ ...prev, query: suggestion, page: 1 })}
            >
              {suggestion}
            </Link>
          ),
        )}
      </div>
    </div>
  )
}
```

### Filter Navigation

Build filtering interfaces with search parameter navigation:

```tsx
import { Link, useSearch } from '@tanstack/react-router'

const categories = ['electronics', 'clothing', 'books', 'home']
const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Customer Rating' },
]

function FilterNavigation() {
  const search = useSearch({ from: '/products' })

  return (
    <aside>
      {/* Category filters */}
      <div>
        <h3>Categories</h3>
        {categories.map((category) => (
          <Link
            key={category}
            search={(prev) => ({
              ...prev,
              category: prev.category === category ? undefined : category,
              page: 1,
            })}
            className={search.category === category ? 'active' : ''}
          >
            {category}
          </Link>
        ))}
      </div>

      {/* Sort options */}
      <div>
        <h3>Sort By</h3>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            search={(prev) => ({ ...prev, sort: option.value, page: 1 })}
            className={search.sort === option.value ? 'active' : ''}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {/* Clear all filters */}
      <Link
        search={(prev) => {
          const { category, sort, minPrice, maxPrice, ...rest } = prev
          return rest
        }}
      >
        Clear All Filters
      </Link>
    </aside>
  )
}
```

### Programmatic Search Controls

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

  return (
    <div>
      <select onChange={(e) => handleSortChange(e.target.value)}>
        <option value="relevance">Sort by Relevance</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>

      <button onClick={handleClearFilters}>Clear Filters</button>
    </div>
  )
}
```

---

## Implementation Notes

### Additional Content Needed:

- [ ] Complete e-commerce filtering example
- [ ] Advanced filter combinations (price ranges, multi-select)
- [ ] Filter state persistence and sharing
- [ ] Search result highlighting and sorting
- [ ] Infinite scroll pagination patterns
- [ ] Filter URL state management best practices
- [ ] Accessibility considerations for filter UIs
- [ ] Mobile-responsive filter patterns

### Cross-References to Add:

- Link to `setup-basic-search-params.md` for foundation
- Link to `navigate-with-search-params.md` for navigation patterns
- Link to `validate-search-params.md` for filter validation
- Forward link to `search-params-with-data-loading.md` for data integration

### README Update Required:

- [ ] Mark guide as completed in progressive series
- [ ] Uncomment "Common Next Steps" in related guides
