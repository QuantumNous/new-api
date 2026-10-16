# DRAFT: Handle Search Parameters in Forms

**Final Destination:** `docs/router/framework/react/how-to/search-params-in-forms.md`  
**Progressive Series Position:** Specialized Use Cases - Guide #10  
**Depends On:** `setup-basic-search-params.md`, `navigate-with-search-params.md`, `validate-search-params.md`  
**Status:** Ready for implementation - form synchronization patterns available

---

## Content Staged from navigate-with-search-params.md

### Navigation with State Synchronization

Keep component state in sync with URL search parameters:

```tsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

function SynchronizedForm() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/products' })

  // Local state synced with URL
  const [localFilters, setLocalFilters] = useState({
    minPrice: search.minPrice || 0,
    maxPrice: search.maxPrice || 1000,
    inStock: search.inStock || false,
  })

  // Update local state when URL changes
  useEffect(() => {
    setLocalFilters({
      minPrice: search.minPrice || 0,
      maxPrice: search.maxPrice || 1000,
      inStock: search.inStock || false,
    })
  }, [search.minPrice, search.maxPrice, search.inStock])

  const applyFilters = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...localFilters,
        page: 1, // Reset pagination
      }),
    })
  }

  const resetFilters = () => {
    const defaultFilters = { minPrice: 0, maxPrice: 1000, inStock: false }
    setLocalFilters(defaultFilters)

    navigate({
      search: (prev) => {
        const { minPrice, maxPrice, inStock, ...rest } = prev
        return rest
      },
    })
  }

  return (
    <div>
      <label>
        Min Price:
        <input
          type="number"
          value={localFilters.minPrice}
          onChange={(e) =>
            setLocalFilters((prev) => ({
              ...prev,
              minPrice: parseInt(e.target.value) || 0,
            }))
          }
        />
      </label>

      <label>
        Max Price:
        <input
          type="number"
          value={localFilters.maxPrice}
          onChange={(e) =>
            setLocalFilters((prev) => ({
              ...prev,
              maxPrice: parseInt(e.target.value) || 1000,
            }))
          }
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={localFilters.inStock}
          onChange={(e) =>
            setLocalFilters((prev) => ({
              ...prev,
              inStock: e.target.checked,
            }))
          }
        />
        In Stock Only
      </label>

      <button onClick={applyFilters}>Apply Filters</button>
      <button onClick={resetFilters}>Reset</button>
    </div>
  )
}
```

### Form with Search Parameter Validation

```tsx
const handleFormSubmit = (formData: FormData) => {
  const query = formData.get('query') as string
  const page = parseInt(formData.get('page') as string) || 1

  safeNavigate({ query, page })
}

return (
  <form action={handleFormSubmit}>
    <input name="query" placeholder="Search..." required />
    <input name="page" type="number" defaultValue="1" />
    <button type="submit">Search</button>
  </form>
)
```

---

## Implementation Notes

### Additional Content Needed:

- [ ] Uncontrolled form patterns with search params
- [ ] Controlled form patterns with real-time updates
- [ ] Form library integration (React Hook Form, Formik)
- [ ] Debounced form updates to URL
- [ ] Form reset and default value handling
- [ ] Multi-step form with URL state
- [ ] File upload forms with search state
- [ ] Form validation error handling with URL feedback

### Cross-References to Add:

- Link to `setup-basic-search-params.md` for foundation
- Link to `navigate-with-search-params.md` for navigation patterns
- Link to `validate-search-params.md` for form validation
- Forward link to `optimize-search-param-performance.md` for debouncing

### README Update Required:

- [ ] Mark guide as completed in progressive series
- [ ] Uncomment "Common Next Steps" in related guides
